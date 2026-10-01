import 'server-only';

import { getServerEnv } from '@/lib/env';

export const KEY_BYTES = 32;

let cachedKey: Buffer | undefined;

/** Master key from `MASTER_ENCRYPTION_KEY`. Never persisted, never logged. */
export function getMasterKey(): Buffer {
  cachedKey ??= Buffer.from(getServerEnv().MASTER_ENCRYPTION_KEY, 'base64');
  return cachedKey;
}

/** Validates a raw key buffer (used when a key is passed explicitly, e.g. tests/rotation). */
export function assertKey(key: Buffer): Buffer {
  if (key.length !== KEY_BYTES) {
    throw new Error(`Encryption key must be ${KEY_BYTES} bytes, got ${key.length}`);
  }
  return key;
}
