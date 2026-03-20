import { generateMfaSecret, verifyMfaToken } from '@/lib/auth/mfa';
import * as OTPAuth from 'otpauth';

describe('MFA utilities', () => {
  it('should generate a valid MFA secret and URI', () => {
    const { secret, uri } = generateMfaSecret('user@example.com');

    expect(secret).toBeDefined();
    expect(secret.length).toBeGreaterThan(0);
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('user%40example.com');
    expect(uri).toContain('ReplyBotzHD');
  });

  it('should verify a valid TOTP token', () => {
    const { secret } = generateMfaSecret('test@example.com');

    // Generate a valid token using the same secret
    const totp = new OTPAuth.TOTP({
      issuer: 'ReplyBotzHD',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const validToken = totp.generate();
    expect(verifyMfaToken(secret, validToken)).toBe(true);
  });

  it('should reject an invalid TOTP token', () => {
    const { secret } = generateMfaSecret('test@example.com');
    expect(verifyMfaToken(secret, '000000')).toBe(false);
  });
});
