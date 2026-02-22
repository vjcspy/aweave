import {
  createCipheriv,
  createHash,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

import type { RelayConfig } from './config';
import { getEffectiveTransportMode } from './config';

const FRAME_IV_LENGTH = 12;
const FRAME_AUTH_TAG_LENGTH = 16;
const V2_MAGIC = Buffer.from('AWR2', 'ascii');
const V2_VERSION = 2;

export interface V2EncryptOptions {
  keyId: string;
  serverPublicKeyPem: string;
}

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
export function encryptPayloadV1(
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

  const plaintext = buildPlaintextFrame(metadata, binaryData);
  const iv = randomBytes(FRAME_IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function encryptPayloadV2(
  metadata: object,
  options: V2EncryptOptions,
  binaryData?: Buffer,
): string {
  const keyId = options.keyId.trim();
  if (!keyId) {
    throw new Error('serverKeyId is required for v2 transport encryption');
  }

  const kidBytes = Buffer.from(keyId, 'utf-8');
  if (kidBytes.length > 255) {
    throw new Error('serverKeyId is too long (max 255 bytes)');
  }

  const serverPublicKey = createPublicKey(options.serverPublicKeyPem);
  const serverPublicKeyDer = Buffer.from(
    serverPublicKey.export({ type: 'spki', format: 'der' }),
  );

  const { privateKey: ephemeralPrivateKey, publicKey: ephemeralPublicKey } =
    generateKeyPairSync('x25519');
  const ephemeralPublicKeyDer = Buffer.from(
    ephemeralPublicKey.export({ type: 'spki', format: 'der' }),
  );

  const plaintext = buildPlaintextFrame(metadata, binaryData);
  const iv = randomBytes(FRAME_IV_LENGTH);
  const contentKey = deriveV2ContentKey(
    diffieHellman({ privateKey: ephemeralPrivateKey, publicKey: serverPublicKey }),
    iv,
    kidBytes,
    ephemeralPublicKeyDer,
    serverPublicKeyDer,
  );

  const header = Buffer.alloc(
    V2_MAGIC.length + 1 + 1 + 2 + FRAME_IV_LENGTH + kidBytes.length + ephemeralPublicKeyDer.length,
  );
  let offset = 0;
  V2_MAGIC.copy(header, offset);
  offset += V2_MAGIC.length;
  header.writeUInt8(V2_VERSION, offset);
  offset += 1;
  header.writeUInt8(kidBytes.length, offset);
  offset += 1;
  header.writeUInt16BE(ephemeralPublicKeyDer.length, offset);
  offset += 2;
  iv.copy(header, offset);
  offset += FRAME_IV_LENGTH;
  kidBytes.copy(header, offset);
  offset += kidBytes.length;
  ephemeralPublicKeyDer.copy(header, offset);

  const cipher = createCipheriv('aes-256-gcm', contentKey, iv);
  cipher.setAAD(header);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([header, authTag, ciphertext]).toString('base64');
}

export function encryptPayload(
  metadata: object,
  config: RelayConfig,
  binaryData?: Buffer,
): string {
  const mode = getEffectiveTransportMode(config);
  if (mode === 'v2') {
    if (!config.serverKeyId || !config.serverPublicKey) {
      throw new Error('Missing v2 relay transport config: serverKeyId/serverPublicKey');
    }

    return encryptPayloadV2(
      metadata,
      {
        keyId: config.serverKeyId,
        serverPublicKeyPem: config.serverPublicKey,
      },
      binaryData,
    );
  }

  if (!config.encryptionKey) {
    throw new Error('Missing legacy relay encryptionKey');
  }

  return encryptPayloadV1(metadata, config.encryptionKey, binaryData);
}

export function normalizePublicKeyPem(publicKeyInput: string): string {
  const key = createPublicKey(publicKeyInput);
  return key.export({ type: 'spki', format: 'pem' }).toString();
}

export function computePublicKeyFingerprint(publicKeyInput: string): string {
  const key = createPublicKey(publicKeyInput);
  const spkiDer = Buffer.from(key.export({ type: 'spki', format: 'der' }));
  return `sha256:${createHash('sha256').update(spkiDer).digest('hex')}`;
}

export function normalizeFingerprint(value: string): string {
  return value.trim().toLowerCase();
}

function buildPlaintextFrame(metadata: object, binaryData?: Buffer): Buffer {
  const metadataBytes = Buffer.from(JSON.stringify(metadata), 'utf-8');
  const metadataLength = Buffer.alloc(4);
  metadataLength.writeUInt32BE(metadataBytes.length, 0);

  return binaryData
    ? Buffer.concat([metadataLength, metadataBytes, binaryData])
    : Buffer.concat([metadataLength, metadataBytes]);
}

function deriveV2ContentKey(
  sharedSecret: Buffer,
  iv: Buffer,
  kidBytes: Buffer,
  ephemeralPublicKeyDer: Buffer,
  serverPublicKeyDer: Buffer,
): Buffer {
  const info = Buffer.concat([
    Buffer.from('relay-transport-v2', 'utf-8'),
    Buffer.from([0]),
    kidBytes,
    Buffer.from([0]),
    ephemeralPublicKeyDer,
    Buffer.from([0]),
    serverPublicKeyDer,
  ]);
  return Buffer.from(hkdfSync('sha256', sharedSecret, iv, info, 32));
}
