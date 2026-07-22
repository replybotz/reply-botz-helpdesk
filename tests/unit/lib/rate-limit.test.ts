const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  set: jest.fn(),
};

jest.mock('@/lib/redis', () => ({
  redis: mockRedis,
  tenantKey: (tenantId: string, ...parts: string[]) => `t:${tenantId}:${parts.join(':')}`,
}));

import {
  isRateLimited,
  enforceRateLimit,
  assertMfaNotLocked,
  recordMfaFailure,
  clearMfaFailures,
  clientIp,
} from '@/lib/rate-limit';
import { RateLimitError } from '@/lib/errors';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isRateLimited', () => {
  it('allows requests under the limit', async () => {
    mockRedis.incr.mockResolvedValue(3);
    expect(await isRateLimited('login:x', { max: 5, windowSec: 300 })).toBe(false);
  });

  it('blocks requests over the limit', async () => {
    mockRedis.incr.mockResolvedValue(6);
    expect(await isRateLimited('login:x', { max: 5, windowSec: 300 })).toBe(true);
  });

  it('always offers a TTL with NX so lost expiries self-heal', async () => {
    mockRedis.incr.mockResolvedValue(1);
    await isRateLimited('login:x', { max: 5, windowSec: 300 });
    expect(mockRedis.expire).toHaveBeenCalledWith('rl:login:x', 300, 'NX');

    // Later hits still offer the TTL (NX makes it a no-op when one exists),
    // healing keys whose initial EXPIRE was lost mid-crash.
    mockRedis.expire.mockClear();
    mockRedis.incr.mockResolvedValue(2);
    await isRateLimited('login:x', { max: 5, windowSec: 300 });
    expect(mockRedis.expire).toHaveBeenCalledWith('rl:login:x', 300, 'NX');
  });

  it('fails open when redis is unavailable', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRedis.incr.mockRejectedValue(new Error('connection refused'));
    expect(await isRateLimited('login:x', { max: 5, windowSec: 300 })).toBe(false);
  });
});

describe('enforceRateLimit', () => {
  it('throws RateLimitError (429) when over budget', async () => {
    mockRedis.incr.mockResolvedValue(100);
    await expect(enforceRateLimit('k', { max: 5, windowSec: 60 })).rejects.toThrow(RateLimitError);
  });
});

describe('MFA lockout', () => {
  it('throws while the lock key exists', async () => {
    mockRedis.exists.mockResolvedValue(1);
    await expect(assertMfaNotLocked('user-1')).rejects.toThrow(RateLimitError);
  });

  it('passes when no lock exists', async () => {
    mockRedis.exists.mockResolvedValue(0);
    await expect(assertMfaNotLocked('user-1')).resolves.toBeUndefined();
  });

  it('sets the lock after 5 failures', async () => {
    mockRedis.incr.mockResolvedValue(5);
    await recordMfaFailure('user-1');
    expect(mockRedis.set).toHaveBeenCalledWith('mfa:lock:user-1', '1', 'EX', 900);
  });

  it('does not lock below the threshold', async () => {
    mockRedis.incr.mockResolvedValue(2);
    await recordMfaFailure('user-1');
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('clears counters on success', async () => {
    await clearMfaFailures('user-1');
    expect(mockRedis.del).toHaveBeenCalledWith('mfa:fail:user-1', 'mfa:lock:user-1');
  });
});

describe('clientIp', () => {
  it('takes the first x-forwarded-for entry', () => {
    const req = new Request('http://x', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } });
    expect(clientIp(req)).toBe('1.2.3.4');
  });

  it('falls back to unknown', () => {
    expect(clientIp(new Request('http://x'))).toBe('unknown');
  });
});
