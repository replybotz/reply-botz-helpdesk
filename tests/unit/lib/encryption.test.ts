import { encrypt, decrypt } from '@/lib/encryption';

// Set required env
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes in hex

describe('Encryption utilities', () => {
  it('should encrypt and decrypt a string round-trip', () => {
    const plaintext = 'sk-secret-api-key-12345';
    const encrypted = encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.split(':').length).toBe(3); // iv:tag:ciphertext

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for same plaintext', () => {
    const plaintext = 'same-api-key';
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);
    expect(enc1).not.toBe(enc2); // Different IVs
  });

  it('should handle unicode strings', () => {
    const plaintext = 'Hello, World! Bonjour!';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should handle special characters', () => {
    const plaintext = '{"key": "value", "special": "!@#$%^&*()"}';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should reject tampered ciphertext', () => {
    const encrypted = encrypt('secret');
    const parts = encrypted.split(':');
    parts[2] = 'tampered' + parts[2];
    expect(() => decrypt(parts.join(':'))).toThrow();
  });
});
