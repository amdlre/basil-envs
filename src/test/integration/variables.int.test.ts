import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createProjectAction } from '@/actions/projects';
import {
  applyRawAction,
  loadRawAction,
  previewRawAction,
  revealVariableAction,
  saveVariablesAction,
} from '@/actions/variables';
import { getDb } from '@/db';
import { getMaskedVariables } from '@/db/queries/variables';
import { auditLogs, envVariables } from '@/db/schema';

import { environmentId, expectFail, expectOk, projectBySlug } from './helpers';

let envId: string;

beforeEach(async () => {
  expectOk(await createProjectAction({ name: 'Seerah', slug: '', description: '' }));
  envId = await environmentId((await projectBySlug('seerah')).id, 'production');
});

const state = () => getMaskedVariables(envId);
const idOf = async (key: string) => {
  const row = (await state()).variables.find((v) => v.key === key);
  if (!row) throw new Error(`no ${key}`);
  return row.id;
};
const reveal = async (key: string) =>
  expectOk(await revealVariableAction({ variableId: await idOf(key), purpose: 'reveal' })).value;

async function save(changes: {
  creates?: { key: string; value: string }[];
  updates?: { id: string; key: string; value?: string }[];
  deletes?: string[];
}) {
  const { version } = await state();
  return saveVariablesAction({
    environmentId: envId,
    version,
    creates: (changes.creates ?? []).map((c, i) => ({ ref: `c${i}`, ...c })),
    updates: (changes.updates ?? []).map((u, i) => ({ ref: `u${i}`, ...u })),
    deletes: changes.deletes ?? [],
  });
}

const SECRET = 'sk_live_51H_super_secret_value';

describe('saving variables', () => {
  it('stores values encrypted and returns only masked rows', async () => {
    expect(
      expectOk(
        await save({
          creates: [
            { key: 'STRIPE_KEY', value: SECRET },
            { key: 'db_url', value: 'postgres://x' },
          ],
        }),
      ),
    ).toEqual({ created: 2, updated: 0, renamed: 0, deleted: 0 });

    const masked = await state();
    expect(masked.variables.map((v) => v.key)).toEqual(['DB_URL', 'STRIPE_KEY']);
    expect(JSON.stringify(masked)).not.toContain(SECRET);

    const [row] = await getDb()
      .select()
      .from(envVariables)
      .where(eq(envVariables.key, 'STRIPE_KEY'));
    expect(row?.encryptedValue).not.toContain('sk_live');
    expect(Buffer.from(row?.encryptedValue ?? '', 'base64').toString()).not.toContain(SECRET);
  });

  it('preserves values exactly (whitespace, unicode, multiline)', async () => {
    const value = '  -----BEGIN KEY-----\nمفتاح 🔐\n-----END KEY-----  ';
    expectOk(await save({ creates: [{ key: 'PEM', value }] }));
    expect(await reveal('PEM')).toBe(value);
  });

  it('renames keep the value (re-encrypted under the new key binding)', async () => {
    expectOk(await save({ creates: [{ key: 'OLD_NAME', value: SECRET }] }));
    expectOk(await save({ updates: [{ id: await idOf('OLD_NAME'), key: 'NEW_NAME' }] }));
    expect(await reveal('NEW_NAME')).toBe(SECRET);
  });

  it('swaps two keys in one save', async () => {
    expectOk(
      await save({
        creates: [
          { key: 'A', value: 'value-a' },
          { key: 'B', value: 'value-b' },
        ],
      }),
    );
    const [a, b] = [await idOf('A'), await idOf('B')];
    expect(
      expectOk(
        await save({
          updates: [
            { id: a, key: 'B' },
            { id: b, key: 'A' },
          ],
        }),
      ).renamed,
    ).toBe(2);
    expect(await reveal('A')).toBe('value-b');
    expect(await reveal('B')).toBe('value-a');
  });

  it('updates and deletes', async () => {
    expectOk(
      await save({
        creates: [
          { key: 'A', value: '1' },
          { key: 'B', value: '2' },
        ],
      }),
    );
    expectOk(
      await save({
        updates: [{ id: await idOf('A'), key: 'A', value: 'one' }],
        deletes: [await idOf('B')],
      }),
    );
    expect((await state()).variables.map((v) => v.key)).toEqual(['A']);
    expect(await reveal('A')).toBe('one');
  });

  it('rejects duplicate and invalid keys with per-row errors', async () => {
    expectOk(await save({ creates: [{ key: 'A', value: '1' }] }));
    expect(
      await save({
        creates: [
          { key: 'A', value: '2' },
          { key: '1BAD', value: '' },
        ],
      }),
    ).toMatchObject({
      ok: false,
      error: 'validation',
      fieldErrors: { 'c0.key': 'keyDuplicate', 'c1.key': 'keyInvalid' },
    });
  });

  it('rejects a stale version (concurrent edit)', async () => {
    const { version } = await state();
    expectOk(await save({ creates: [{ key: 'A', value: '1' }] }));
    expectFail(
      await saveVariablesAction({
        environmentId: envId,
        version,
        creates: [{ ref: 'x', key: 'B', value: '2' }],
        updates: [],
        deletes: [],
      }),
      'stale',
    );
  });

  it('binds ciphertext to its row: a value copied to another row will not decrypt', async () => {
    expectOk(
      await save({
        creates: [
          { key: 'A', value: SECRET },
          { key: 'B', value: 'other' },
        ],
      }),
    );
    const [source] = await getDb().select().from(envVariables).where(eq(envVariables.key, 'A'));
    await getDb()
      .update(envVariables)
      .set({ encryptedValue: source?.encryptedValue, iv: source?.iv, authTag: source?.authTag })
      .where(eq(envVariables.key, 'B'));

    expectFail(
      await revealVariableAction({ variableId: await idOf('B'), purpose: 'reveal' }),
      'decryptionFailed',
    );
  });

  it('audits keys but never values', async () => {
    expectOk(await save({ creates: [{ key: 'STRIPE_KEY', value: SECRET }] }));
    await reveal('STRIPE_KEY');
    expectOk(await revealVariableAction({ variableId: await idOf('STRIPE_KEY'), purpose: 'copy' }));

    const logs = await getDb().select().from(auditLogs);
    expect(logs.map((l) => l.action)).toEqual(
      expect.arrayContaining(['variables.saved', 'variable.revealed', 'variable.copied']),
    );
    expect(JSON.stringify(logs)).not.toContain(SECRET);
    expect(JSON.stringify(logs)).toContain('STRIPE_KEY');
  });
});

describe('raw .env mode', () => {
  beforeEach(async () => {
    expectOk(
      await save({
        creates: [
          { key: 'KEEP', value: 'same' },
          { key: 'CHANGE', value: 'old' },
          { key: 'GONE', value: SECRET },
        ],
      }),
    );
  });

  const content = 'KEEP=same\nCHANGE=new\nADDED="hello world"\n';

  it('loads the full file (audited) and round-trips through the parser', async () => {
    const { content: loaded } = expectOk(await loadRawAction({ environmentId: envId }));
    expect(loaded).toBe(`CHANGE=old\nGONE=${SECRET}\nKEEP=same\n`);
    const [log] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'variables.revealed_all'));
    expect(log?.metadata).toMatchObject({ count: 3 });
  });

  it('previews a merge without returning any values', async () => {
    const preview = expectOk(
      await previewRawAction({ environmentId: envId, content, removeMissing: false }),
    );
    expect(preview.diff).toEqual({
      added: ['ADDED'],
      changed: ['CHANGE'],
      removed: [],
      unchanged: 1,
    });
    expect(JSON.stringify(preview)).not.toContain(SECRET);
    expect(JSON.stringify(preview)).not.toContain('old');
  });

  it('previews replace mode with removals', async () => {
    const preview = expectOk(
      await previewRawAction({ environmentId: envId, content, removeMissing: true }),
    );
    expect(preview.diff?.removed).toEqual(['GONE']);
  });

  it('returns parse errors instead of a diff', async () => {
    const preview = expectOk(
      await previewRawAction({
        environmentId: envId,
        content: 'OK=1\nnot valid',
        removeMissing: false,
      }),
    );
    expect(preview.diff).toBeNull();
    expect(preview.errors).toEqual([{ line: 2, code: 'missingEquals' }]);
  });

  it('applies merge and replace', async () => {
    let { version } = await state();
    expect(
      expectOk(
        await applyRawAction({ environmentId: envId, content, removeMissing: false, version }),
      ),
    ).toEqual({ created: 1, updated: 1, renamed: 0, deleted: 0 });
    expect(await reveal('ADDED')).toBe('hello world');
    expect(await reveal('GONE')).toBe(SECRET);

    ({ version } = await state());
    expect(
      expectOk(
        await applyRawAction({ environmentId: envId, content, removeMissing: true, version }),
      ).deleted,
    ).toBe(1);
    expect((await state()).variables.map((v) => v.key)).toEqual(['ADDED', 'CHANGE', 'KEEP']);
  });

  it('refuses to apply content with parse errors or a stale version', async () => {
    const { version } = await state();
    expect(
      await applyRawAction({
        environmentId: envId,
        content: 'nope',
        removeMissing: false,
        version,
      }),
    ).toMatchObject({ ok: false, error: 'validation', fieldErrors: { _form: 'rawHasErrors' } });
    expectFail(
      await applyRawAction({ environmentId: envId, content, removeMissing: false, version: 'old' }),
      'stale',
    );
  });
});
