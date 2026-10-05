import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { copyFromEnvironmentAction, previewCopyFromAction } from '@/actions/copy-from';
import { addEnvironmentAction } from '@/actions/environments';
import { createProjectAction } from '@/actions/projects';
import { revealVariableAction, saveVariablesAction } from '@/actions/variables';
import { getDb } from '@/db';
import { getMaskedVariables } from '@/db/queries/variables';
import { auditLogs } from '@/db/schema';

import { environmentId, expectFail, expectOk, projectBySlug, typeBySlug } from './helpers';

let projectId: string;
let local: string;
let production: string;

async function seed(envId: string, vars: Record<string, string>) {
  const { version } = await getMaskedVariables(envId);
  expectOk(
    await saveVariablesAction({
      environmentId: envId,
      version,
      creates: Object.entries(vars).map(([key, value], i) => ({ ref: `r${i}`, key, value })),
      updates: [],
      deletes: [],
    }),
  );
}

async function valuesOf(envId: string) {
  const { variables } = await getMaskedVariables(envId);
  const entries = await Promise.all(
    variables.map(async (v) => {
      const result = expectOk(await revealVariableAction({ variableId: v.id, purpose: 'reveal' }));
      return [v.key, result.value] as const;
    }),
  );
  return Object.fromEntries(entries);
}

const copy = async (
  mode: 'keys' | 'values',
  overwrite: boolean,
  source = local,
  target = production,
) =>
  copyFromEnvironmentAction({
    targetEnvironmentId: target,
    sourceEnvironmentId: source,
    mode,
    overwrite,
    version: (await getMaskedVariables(target)).version,
  });

beforeEach(async () => {
  expectOk(await createProjectAction({ name: 'Seerah', slug: '', description: '' }));
  projectId = (await projectBySlug('seerah')).id;
  local = await environmentId(projectId, 'local');
  production = await environmentId(projectId, 'production');
  await seed(local, { A: 'local-a', B: 'local-b', C: 'local-c' });
  await seed(production, { B: 'prod-b', C: 'local-c' });
});

describe('copy from environment', () => {
  it('previews without returning values', async () => {
    const preview = expectOk(
      await previewCopyFromAction({
        targetEnvironmentId: production,
        sourceEnvironmentId: local,
        mode: 'values',
        overwrite: true,
      }),
    );
    expect(preview).toEqual({ add: ['A'], overwrite: ['B'], skip: ['C'] });
    expect(JSON.stringify(preview)).not.toContain('local-a');
  });

  it('keys only adds empty values and leaves existing values alone', async () => {
    expect(expectOk(await copy('keys', true))).toMatchObject({ created: 1, updated: 0 });
    expect(await valuesOf(production)).toEqual({ A: '', B: 'prod-b', C: 'local-c' });
  });

  it('keys + values re-encrypts values for the target (and overwrites only when asked)', async () => {
    expect(expectOk(await copy('values', false))).toMatchObject({ created: 1, updated: 0 });
    expect(await valuesOf(production)).toEqual({ A: 'local-a', B: 'prod-b', C: 'local-c' });

    expect(expectOk(await copy('values', true))).toMatchObject({ created: 0, updated: 1 });
    expect(await valuesOf(production)).toEqual({ A: 'local-a', B: 'local-b', C: 'local-c' });
  });

  it('audits the source environment and keys, never values', async () => {
    expectOk(await copy('values', true));
    const [log] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'variables.copied_from'));
    expect(log?.metadata).toMatchObject({
      source: 'local',
      mode: 'values',
      created: ['A'],
      updated: ['B'],
    });
    expect(JSON.stringify(log)).not.toContain('local-a');
  });

  it('rejects copying into itself, across projects, and stale versions', async () => {
    expectFail(await copy('keys', false, production, production), 'validation');

    expectOk(await createProjectAction({ name: 'Other', slug: '', description: '' }));
    const other = await environmentId((await projectBySlug('other')).id, 'local');
    expectFail(await copy('values', false, other, production), 'forbidden');

    expectFail(
      await copyFromEnvironmentAction({
        targetEnvironmentId: production,
        sourceEnvironmentId: local,
        mode: 'keys',
        overwrite: false,
        version: 'stale',
      }),
      'stale',
    );
  });

  it('works from a newly added environment with no variables', async () => {
    expectOk(await addEnvironmentAction({ projectId, typeId: (await typeBySlug('staging')).id }));
    const staging = await environmentId(projectId, 'staging');
    expect(expectOk(await copy('keys', false, staging))).toMatchObject({ created: 0 });
  });
});
