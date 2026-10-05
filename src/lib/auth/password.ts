import { createHash } from 'node:crypto';

import { hash, verify } from '@node-rs/argon2';

// argon2id (the library default) with the OWASP baseline: m=19 MiB, t=2, p=1.
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Verified against when the email doesn't exist, so response timing doesn't reveal it.
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('timing-equalizer-not-a-real-password');
  await verifyPassword(await dummyHash, password);
}

/** Short, non-reversible fingerprint of the current hash; embedded in session tokens. */
export function passwordFingerprint(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('base64url').slice(0, 16);
}
