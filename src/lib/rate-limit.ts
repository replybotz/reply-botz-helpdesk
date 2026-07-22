import { redis } from '@/lib/redis';
import { RateLimitError } from '@/lib/errors';

/**
 * When Redis is unreachable, requests are allowed through (fail-open) so a
 * cache outage does not lock everyone out of a self-hosted deployment.
 * Flip to false to fail closed instead.
 */
const FAIL_OPEN = true;

export interface RateLimitOptions {
  /** Maximum requests allowed within the window. */
  max: number;
  /** Window length in seconds (fixed window). */
  windowSec: number;
}

export async function isRateLimited(key: string, options: RateLimitOptions): Promise<boolean> {
  try {
    const fullKey = `rl:${key}`;
    const count = await redis.incr(fullKey);
    if (count === 1) {
      await redis.expire(fullKey, options.windowSec);
    }
    return count > options.max;
  } catch (error) {
    console.error('Rate limiter unavailable:', error);
    return !FAIL_OPEN;
  }
}

/** Throws RateLimitError (429) when the key exceeds its budget. */
export async function enforceRateLimit(key: string, options: RateLimitOptions): Promise<void> {
  if (await isRateLimited(key, options)) {
    throw new RateLimitError();
  }
}

export async function clearRateLimit(key: string): Promise<void> {
  try {
    await redis.del(`rl:${key}`);
  } catch (error) {
    console.error('Rate limiter unavailable:', error);
  }
}

const MFA_MAX_FAILURES = 5;
const MFA_LOCK_SEC = 15 * 60;

/** Throws when the user is locked out from too many failed MFA attempts. */
export async function assertMfaNotLocked(userId: string): Promise<void> {
  try {
    if (await redis.exists(`mfa:lock:${userId}`)) {
      throw new RateLimitError('Too many failed MFA attempts. Try again later.');
    }
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    console.error('Rate limiter unavailable:', error);
    if (!FAIL_OPEN) throw new RateLimitError();
  }
}

export async function recordMfaFailure(userId: string): Promise<void> {
  try {
    const key = `mfa:fail:${userId}`;
    const failures = await redis.incr(key);
    if (failures === 1) {
      await redis.expire(key, MFA_LOCK_SEC);
    }
    if (failures >= MFA_MAX_FAILURES) {
      await redis.set(`mfa:lock:${userId}`, '1', 'EX', MFA_LOCK_SEC);
    }
  } catch (error) {
    console.error('Rate limiter unavailable:', error);
  }
}

export async function clearMfaFailures(userId: string): Promise<void> {
  try {
    await redis.del(`mfa:fail:${userId}`, `mfa:lock:${userId}`);
  } catch (error) {
    console.error('Rate limiter unavailable:', error);
  }
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
