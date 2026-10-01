import { randomBytes } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

const validEnv = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  MASTER_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  JWT_SECRET: 'j'.repeat(40),
};

async function loadWith(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const { getServerEnv } = await import('../env');
  return getServerEnv;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getServerEnv', () => {
  it('accepts a valid environment', async () => {
    const getServerEnv = await loadWith(validEnv);
    expect(getServerEnv().DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });

  it('rejects a master key that is not 32 bytes', async () => {
    const getServerEnv = await loadWith({
      ...validEnv,
      MASTER_ENCRYPTION_KEY: randomBytes(16).toString('base64'),
    });
    expect(() => getServerEnv()).toThrow(/MASTER_ENCRYPTION_KEY: must decode to exactly 32 bytes/);
  });

  it('rejects a short JWT secret', async () => {
    const getServerEnv = await loadWith({ ...validEnv, JWT_SECRET: 'short' });
    expect(() => getServerEnv()).toThrow(/JWT_SECRET/);
  });

  it('rejects a non-postgres DATABASE_URL', async () => {
    const getServerEnv = await loadWith({ ...validEnv, DATABASE_URL: 'mysql://u:p@h/db' });
    expect(() => getServerEnv()).toThrow(/DATABASE_URL/);
  });

  it('never includes secret values in the error message', async () => {
    const badKey = 'c2hvcnQta2V5';
    const getServerEnv = await loadWith({ ...validEnv, MASTER_ENCRYPTION_KEY: badKey });
    expect(() => getServerEnv()).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(badKey) as string }),
    );
  });
});
