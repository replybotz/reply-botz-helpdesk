import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY environment variable is required');
  const buffer = Buffer.from(key, 'hex');
  if (buffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes) for AES-256');
  }
  return buffer;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encrypted] = ciphertext.split(':');
  if (!ivHex || !tagHex || !encrypted) {
    throw new Error('Invalid ciphertext format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
