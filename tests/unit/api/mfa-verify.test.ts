/**
 * Regression tests for the MFA setup/login branch selection.
 *
 * The original vulnerability: the route branched on the mere presence of
 * x-user-id (which the middleware also set for MFA-PENDING tokens on
 * /api/auth/mfa) and accepted a client-supplied TOTP secret — letting a
 * password-only attacker overwrite the victim's MFA secret. The fix keys
 * the branch off the verified token's mfaPending claim and only trusts a
 * server-side pending secret held in Redis.
 */
process.env.JWT_SECRET = 'test-secret-for-mfa-route-tests';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);

const mockHeaders = new Map<string, string>();
jest.mock('next/headers', () => ({
  headers: async () => ({
    get: (key: string) => mockHeaders.get(key) ?? null,
  }),
}));

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};
jest.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn().mockResolvedValue(0),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn(),
};
jest.mock('@/lib/redis', () => ({
  redis: mockRedis,
  tenantKey: (tenantId: string, ...parts: string[]) => `t:${tenantId}:${parts.join(':')}`,
}));

jest.mock('@/lib/audit', () => ({ audit: jest.fn() }));
jest.mock('@/lib/auth/session', () => ({
  createSession: jest.fn().mockResolvedValue({
    refreshToken: 'new-refresh-token',
    expiresAt: new Date('2030-01-01'),
  }),
}));

import * as OTPAuth from 'otpauth';
import { POST } from '@/app/api/auth/mfa/verify/route';
import { encrypt } from '@/lib/encryption';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_ID = '22222222-2222-2222-2222-222222222222';
const SECRET = new OTPAuth.Secret().base32;

function totpNow(secret: string): string {
  return new OTPAuth.TOTP({ digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) }).generate();
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://x/api/auth/mfa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function asFullyAuthenticated() {
  mockHeaders.set('x-user-id', USER_ID);
  mockHeaders.set('x-tenant-id', TENANT_ID);
  mockHeaders.delete('x-mfa-pending');
}

function asMfaPending() {
  mockHeaders.set('x-user-id', USER_ID);
  mockHeaders.set('x-tenant-id', TENANT_ID);
  mockHeaders.set('x-mfa-pending', '1');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHeaders.clear();
  mockRedis.exists.mockResolvedValue(0);
  mockRedis.incr.mockResolvedValue(1);
});

describe('MFA setup verification (fully authenticated)', () => {
  it('enables MFA using the server-side pending secret', async () => {
    asFullyAuthenticated();
    mockRedis.get.mockResolvedValue(encrypt(SECRET));
    mockPrisma.user.update.mockResolvedValue({});

    const res = await POST(makeRequest({ token: totpNow(SECRET) }));

    expect(res.status).toBe(200);
    expect(mockRedis.get).toHaveBeenCalledWith(`t:${TENANT_ID}:mfa-setup:${USER_ID}`);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: expect.objectContaining({ mfaEnabled: true }),
      }),
    );
  });

  it('rejects setup when no server-side pending secret exists, even if the client supplies one', async () => {
    asFullyAuthenticated();
    mockRedis.get.mockResolvedValue(null);

    // Old attack shape: attacker-controlled secret in the body
    const res = await POST(makeRequest({ token: totpNow(SECRET), secret: SECRET }));

    expect(res.status).toBe(401);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

describe('MFA login verification (mfa-pending session)', () => {
  const storedUser = {
    id: USER_ID,
    tenantId: TENANT_ID,
    email: 'victim@example.com',
    displayName: 'Victim',
    role: 'AGENT',
    status: 'ACTIVE',
    mfaEnabled: true,
    mfaSecret: encrypt(SECRET),
  };

  it('an mfa-pending session must NOT reach the setup branch (regression for MFA-overwrite bypass)', async () => {
    asMfaPending();
    mockPrisma.user.findUnique.mockResolvedValue(storedUser);
    mockPrisma.user.update.mockResolvedValue({});

    // Attacker knows only the password; tries to plant their own secret.
    const attackerSecret = new OTPAuth.Secret().base32;
    const res = await POST(makeRequest({ token: totpNow(attackerSecret), secret: attackerSecret }));

    // The attacker's code is checked against the VICTIM's stored secret and fails.
    expect(res.status).toBe(401);
    // mfaSecret is never overwritten.
    const updates = mockPrisma.user.update.mock.calls.map(([args]) => args?.data ?? {});
    expect(updates.every((d) => !('mfaSecret' in d))).toBe(true);
    // The setup path (Redis pending secret) is never consulted.
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('completes login with a valid code against the stored secret', async () => {
    asMfaPending();
    mockPrisma.user.findUnique.mockResolvedValue(storedUser);
    mockPrisma.user.update.mockResolvedValue({});

    const res = await POST(makeRequest({ token: totpNow(SECRET) }));

    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('accessToken=') && c.includes('HttpOnly'))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    const body = await res.json();
    expect(body.user.email).toBe('victim@example.com');
    // Tokens never appear in the response body.
    expect(body.tokens).toBeUndefined();
  });

  it('records a failure on a wrong code', async () => {
    asMfaPending();
    mockPrisma.user.findUnique.mockResolvedValue(storedUser);

    const res = await POST(makeRequest({ token: '000000' }));

    expect(res.status).toBe(401);
    expect(mockRedis.incr).toHaveBeenCalledWith(`mfa:fail:${USER_ID}`);
  });

  it('refuses verification while locked out', async () => {
    asMfaPending();
    mockRedis.exists.mockResolvedValue(1);

    const res = await POST(makeRequest({ token: totpNow(SECRET) }));

    expect(res.status).toBe(429);
  });
});
