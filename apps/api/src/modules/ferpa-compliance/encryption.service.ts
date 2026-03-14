import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly ivLength = 16;
  private readonly authTagLength = 16;

  constructor(private readonly configService: ConfigService) {
    const keyHex = this.configService.get<string>('ENCRYPTION_KEY');
    if (!keyHex) {
      this.logger.warn(
        'ENCRYPTION_KEY not set! Using generated key (NOT suitable for production)',
      );
      // Generate a key for development only
      this.key = crypto.randomBytes(32);
    } else {
      this.key = Buffer.from(keyHex, 'hex');
      if (this.key.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
      }
    }
  }

  /**
   * Encrypt a plaintext string using AES-256-GCM.
   * Returns a base64-encoded string: IV + AuthTag + CipherText
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;

    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv, {
      authTagLength: this.authTagLength,
    });

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Combine: iv (16 bytes) + authTag (16 bytes) + encrypted
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Decrypt a base64-encoded encrypted string.
   */
  decrypt(encryptedBase64: string): string {
    if (!encryptedBase64) return encryptedBase64;

    const combined = Buffer.from(encryptedBase64, 'base64');

    const iv = combined.subarray(0, this.ivLength);
    const authTag = combined.subarray(this.ivLength, this.ivLength + this.authTagLength);
    const ciphertext = combined.subarray(this.ivLength + this.authTagLength);

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv, {
      authTagLength: this.authTagLength,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Hash a value for consistent lookups (e.g., email search).
   * Uses HMAC-SHA256 so it's deterministic but not reversible.
   */
  hash(value: string): string {
    return crypto.createHmac('sha256', this.key).update(value.toLowerCase().trim()).digest('hex');
  }

  /**
   * Encrypt PII fields in an object. Returns a new object with specified fields encrypted.
   */
  encryptFields<T extends Record<string, unknown>>(obj: T, fields: (keyof T)[]): T {
    const result = { ...obj };
    for (const field of fields) {
      if (result[field] && typeof result[field] === 'string') {
        (result as Record<string, unknown>)[field as string] = this.encrypt(
          result[field] as string,
        );
      }
    }
    return result;
  }

  /**
   * Decrypt PII fields in an object. Returns a new object with specified fields decrypted.
   */
  decryptFields<T extends Record<string, unknown>>(obj: T, fields: (keyof T)[]): T {
    const result = { ...obj };
    for (const field of fields) {
      if (result[field] && typeof result[field] === 'string') {
        try {
          (result as Record<string, unknown>)[field as string] = this.decrypt(
            result[field] as string,
          );
        } catch (err) {
          this.logger.error(`Failed to decrypt field ${String(field)}: ${(err as Error).message}`);
          // Leave as-is to avoid data loss
        }
      }
    }
    return result;
  }
}
