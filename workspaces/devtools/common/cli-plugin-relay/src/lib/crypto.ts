import { createCipheriv, randomBytes } from 'node:crypto';

/**
 * Encrypt metadata + optional binary data into a self-contained base64 blob.
 *
 * Binary frame format:
 * [4B metadataLen (uint32BE)] [JSON metadata bytes] [raw binary data?]
 *
 * Encrypted blob format:
 * [12B iv] [16B authTag] [ciphertext]
 *
 * @param metadata - JSON object metadata
 * @param keyBase64 - Base64-encoded 32-byte AES key
 * @param binaryData - Optional raw bytes to append after metadata
 * @returns base64(iv + authTag + ciphertext)
 */
export function encryptPayload(
  metadata: object,
  keyBase64: string,
  binaryData?: Buffer,
): string {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `Invalid encryption key length: expected 32 bytes, got ${key.length}`,
    );
  }

  const metadataBytes = Buffer.from(JSON.stringify(metadata), 'utf-8');
  const metadataLength = Buffer.alloc(4);
  metadataLength.writeUInt32BE(metadataBytes.length, 0);

  const plaintext = binaryData
    ? Buffer.concat([metadataLength, metadataBytes, binaryData])
    : Buffer.concat([metadataLength, metadataBytes]);

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}
