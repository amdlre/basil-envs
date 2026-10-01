import { createCipheriv, randomBytes } from 'node:crypto';

import { assertKey, getMasterKey } from './key';
import {
  ALGORITHM,
  AUTH_TAG_BYTES,
  IV_BYTES,
  type CryptoOptions,
  type EncryptedPayload,
} from './types';

/** Encrypts a UTF-8 string with AES-256-GCM using a fresh random IV. */
export function encrypt(plaintext: string, options: CryptoOptions = {}): EncryptedPayload {
  const key = assertKey(options.key ?? getMasterKey());
  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
  if (options.aad !== undefined) cipher.setAAD(Buffer.from(options.aad, 'utf8'));

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}
