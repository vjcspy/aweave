import { createCipheriv, randomBytes } from 'node:crypto';

export interface EncryptResult {
  encrypted: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/**
 * Encrypt data using AES-256-GCM.
 *
 * @param data - Raw data to encrypt (patch content)
 * @param keyBase64 - Base64-encoded 32-byte AES key
 * @returns Encrypted buffer, IV, and auth tag
 */
export function encrypt(data: Buffer, keyBase64: string): EncryptResult {
  const key = Buffer.from(keyBase64, 'base64');

  if (key.length !== 32) {
    throw new Error(
      `Invalid encryption key length: expected 32 bytes, got ${key.length}`,
    );
  }

  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  return { encrypted, iv, authTag };
}
