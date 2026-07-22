import * as OTPAuth from 'otpauth';
import { tenantKey } from '@/lib/redis';

const ISSUER = process.env.MFA_ISSUER || 'ReplyBotzHD';

/** Redis key holding the encrypted, server-generated secret awaiting setup verification. */
export function pendingMfaSecretKey(tenantId: string, userId: string): string {
  return tenantKey(tenantId, 'mfa-setup', userId);
}

export function generateMfaSecret(email: string): { secret: string; uri: string } {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  };
}

export function verifyMfaToken(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}
