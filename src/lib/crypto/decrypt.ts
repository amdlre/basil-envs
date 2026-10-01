import { createDecipheriv } from 'node:crypto';

import { assertKey, getMasterKey } from './key';
import {
  ALGORITHM,
  AUTH_TAG_BYTES,
  IV_BYTES,
  type CryptoOptions,
  type EncryptedPayload,
} from './types';

export class DecryptionError extends Error {
  constructor() {
    // Deliberately generic: never echo ciphertext, key material or the underlying cause.
    super('Unable to decrypt value');
    this.name = 'DecryptionError';
  }
}

/**
 * Decrypts an AES-256-GCM payload. Throws `DecryptionError` if the key, IV, tag, AAD
 * or ciphertext don't match (i.e. on any tampering).
 */
export function decrypt(payload: EncryptedPayload, options: CryptoOptions = {}): string {
  const key = assertKey(options.key ?? getMasterKey());
  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new DecryptionError();
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
    decipher.setAuthTag(authTag);
    if (options.aad !== undefined) decipher.setAAD(Buffer.from(options.aad, 'utf8'));

    return Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new DecryptionError();
  }
}
