import { describe, expect, it } from 'vitest';

import { hashPassword, passwordFingerprint, verifyPassword } from '../password';

describe('password hashing', () => {
  it('hashes with argon2id and the configured cost', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword(hash, 'correct horse battery staple')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'Correct horse battery staple')).resolves.toBe(false);
  });

  it('returns false (not throw) for a malformed hash', async () => {
    await expect(verifyPassword('not-a-hash', 'anything')).resolves.toBe(false);
  });

  it('salts every hash', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(a).not.toBe(b);
  });

  it('fingerprint is stable per hash and changes with the password', async () => {
    const a = await hashPassword('first-password');
    const b = await hashPassword('second-password');
    expect(passwordFingerprint(a)).toBe(passwordFingerprint(a));
    expect(passwordFingerprint(a)).not.toBe(passwordFingerprint(b));
    expect(passwordFingerprint(a)).toHaveLength(16);
    expect(a).not.toContain(passwordFingerprint(a));
  });
});
