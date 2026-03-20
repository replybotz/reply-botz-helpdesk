import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('Password hashing', () => {
  it('should hash and verify a password correctly', async () => {
    const password = 'TestPassword123!';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$argon2id$')).toBe(true);

    const isValid = await verifyPassword(hash, password);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const hash = await hashPassword('CorrectPassword123!');
    const isValid = await verifyPassword(hash, 'WrongPassword123!');
    expect(isValid).toBe(false);
  });

  it('should produce different hashes for same password', async () => {
    const password = 'SamePassword123!';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);
  });
});
