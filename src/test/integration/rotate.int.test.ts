import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createProjectAction } from '@/actions/projects';
import { saveVariablesAction } from '@/actions/variables';
import { getDb } from '@/db';
import { getMaskedVariables } from '@/db/queries/variables';
import { envVariables } from '@/db/schema';
import { decrypt, variableAad } from '@/lib/crypto';
import { rotateMasterKey } from '@/lib/variables/rotate';

import { environmentId, expectOk, projectBySlug } from './helpers';

const currentKey = () => Buffer.from(process.env.MASTER_ENCRYPTION_KEY ?? '', 'base64');

async function seed() {
  expectOk(await createProjectAction({ name: 'Seerah', slug: '', description: '' }));
  const envId = await environmentId((await projectBySlug('seerah')).id, 'production');
  const { version } = await getMaskedVariables(envId);
  expectOk(
    await saveVariablesAction({
      environmentId: envId,
      version,
      creates: [
        { ref: 'a', key: 'A', value: 'alpha' },
        { ref: 'b', key: 'B', value: 'multi\nline 🔐' },
      ],
      updates: [],
      deletes: [],
    }),
  );
}

const openAll = async (key: Buffer) =>
  (await getDb().select().from(envVariables)).map((row) =>
    decrypt(
      { ciphertext: row.encryptedValue, iv: row.iv, authTag: row.authTag },
      { aad: variableAad(row.environmentId, row.key), key },
    ),
  );

describe('rotateMasterKey', () => {
  it('re-encrypts every value with the new key, keeping the row binding', async () => {
    await seed();
    const newKey = randomBytes(32);
    expect(await rotateMasterKey(getDb(), currentKey(), newKey)).toEqual({
      rotated: 2,
      dryRun: false,
    });
    expect((await openAll(newKey)).sort()).toEqual(['alpha', 'multi\nline 🔐']);
    await expect(openAll(currentKey())).rejects.toThrow(); // old key no longer works
    // Rotate back so later tests (and the app key) keep working.
    await rotateMasterKey(getDb(), newKey, currentKey());
  });

  it('dry run proves rotation without changing anything', async () => {
    await seed();
    const before = await getDb().select().from(envVariables);
    expect(await rotateMasterKey(getDb(), currentKey(), randomBytes(32), { dryRun: true })).toEqual(
      {
        rotated: 2,
        dryRun: true,
      },
    );
    expect(await getDb().select().from(envVariables)).toEqual(before);
  });

  it('rolls back everything if the old key is wrong', async () => {
    await seed();
    const before = await getDb().select().from(envVariables);
    await expect(rotateMasterKey(getDb(), randomBytes(32), randomBytes(32))).rejects.toThrow();
    expect(await getDb().select().from(envVariables)).toEqual(before);
  });

  it('refuses identical or malformed keys', async () => {
    await expect(rotateMasterKey(getDb(), currentKey(), currentKey())).rejects.toThrow(/differ/);
    await expect(rotateMasterKey(getDb(), randomBytes(16), randomBytes(32))).rejects.toThrow(
      /32 bytes/,
    );
  });
});
