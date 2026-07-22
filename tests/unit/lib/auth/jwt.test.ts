import { signAccessToken, verifyAccessToken, signMfaToken, verifyMfaToken, generateRefreshToken } from '@/lib/auth/jwt';

// Set required env
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-signing-key-1234567890';

describe('JWT utilities', () => {
  const testPayload = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: '660e8400-e29b-41d4-a716-446655440000',
    role: 'AGENT',
    email: 'test@example.com',
  };

  it('should sign and verify an access token', async () => {
    const token = await signAccessToken(testPayload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const payload = await verifyAccessToken(token);
    expect(payload.sub).toBe(testPayload.userId);
    expect(payload.tenantId).toBe(testPayload.tenantId);
    expect(payload.role).toBe(testPayload.role);
    expect(payload.email).toBe(testPayload.email);
  });

  it('should reject invalid tokens', async () => {
    await expect(verifyAccessToken('invalid-token')).rejects.toThrow();
  });

  it('should reject MFA-pending tokens as access tokens', async () => {
    const mfaToken = await signMfaToken({
      userId: testPayload.userId,
      tenantId: testPayload.tenantId,
    });

    await expect(verifyAccessToken(mfaToken)).rejects.toThrow('MFA verification required');
  });

  it('should sign and verify MFA tokens', async () => {
    const mfaToken = await signMfaToken({
      userId: testPayload.userId,
      tenantId: testPayload.tenantId,
    });

    const payload = await verifyMfaToken(mfaToken);
    expect(payload.sub).toBe(testPayload.userId);
    expect(payload.mfaPending).toBe(true);
  });

  it('should reject access tokens as MFA tokens', async () => {
    const token = await signAccessToken(testPayload);
    await expect(verifyMfaToken(token)).rejects.toThrow('Invalid MFA token');
  });

  it('should generate unique refresh tokens', () => {
    const t1 = generateRefreshToken();
    const t2 = generateRefreshToken();
    expect(t1).not.toBe(t2);
    expect(t1.length).toBeGreaterThan(20);
  });
});
