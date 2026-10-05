'use server';

import { refresh } from 'next/cache';

import { getDb } from '@/db';
import type { Database } from '@/db';
import { fail, ok } from '@/lib/action-result';
import { authedAction } from '@/lib/safe-action';
import { applyCopyFromSchema, copyFromSchema } from '@/lib/validations/variables';
import { commitPlan, withDecryptionGuard } from '@/lib/variables/commit';
import { buildCopyPlan, type CopyMode, type CopySummary } from '@/lib/variables/copy';
import { loadEnvironment, loadStoredVariables, openValue, type Tx } from '@/lib/variables/store';

type Executor = Database | Tx;

/**
 * Loads both sides. Source values are decrypted only for "keys + values"; target values
 * only when overwriting (to skip identical values). Nothing decrypted leaves the server.
 */
async function loadCopyInputs(
  db: Executor,
  input: {
    targetEnvironmentId: string;
    sourceEnvironmentId: string;
    mode: CopyMode;
    overwrite: boolean;
  },
) {
  const [target, source] = await Promise.all([
    loadEnvironment(db, input.targetEnvironmentId),
    loadEnvironment(db, input.sourceEnvironmentId),
  ]);
  if (!target || !source) return fail('notFound');
  if (target.projectId !== source.projectId) return fail('forbidden');

  const [targetRows, sourceRows] = await Promise.all([
    loadStoredVariables(db, target.id),
    loadStoredVariables(db, source.id),
  ]);
  const withValues = input.mode === 'values';

  return {
    source,
    targetEntries: targetRows.map((row) => ({
      id: row.id,
      key: row.key,
      ...(withValues && input.overwrite ? { value: openValue(target.id, row) } : {}),
    })),
    sourceEntries: sourceRows.map((row) => ({
      key: row.key,
      value: withValues ? openValue(source.id, row) : '',
    })),
  };
}

export const previewCopyFromAction = authedAction(async (_session, input: unknown) => {
  const parsed = copyFromSchema.safeParse(input);
  if (!parsed.success) return fail('validation');

  return withDecryptionGuard(async () => {
    const loaded = await loadCopyInputs(getDb(), parsed.data);
    if ('ok' in loaded) return loaded;
    const { summary } = buildCopyPlan(
      loaded.targetEntries,
      loaded.sourceEntries,
      parsed.data.mode,
      parsed.data.overwrite,
    );
    return ok<CopySummary>(summary);
  });
});

export const copyFromEnvironmentAction = authedAction(async (_session, input: unknown) => {
  const parsed = applyCopyFromSchema.safeParse(input);
  if (!parsed.success) return fail('validation');
  const { targetEnvironmentId, sourceEnvironmentId, version, mode, overwrite } = parsed.data;
  const source = await loadEnvironment(getDb(), sourceEnvironmentId);
  if (!source) return fail('notFound');

  const result = await withDecryptionGuard(() =>
    commitPlan(
      targetEnvironmentId,
      version,
      async ({ tx }) => {
        // Re-read inside the locked transaction: never trust the preview.
        const loaded = await loadCopyInputs(tx, parsed.data);
        if ('ok' in loaded) return loaded;
        return buildCopyPlan(loaded.targetEntries, loaded.sourceEntries, mode, overwrite).plan;
      },
      'variables.copied_from',
      { mode, overwrite, source: source.typeSlug, sourceEnvironmentId },
    ),
  );
  if (result.ok) refresh();
  return result;
});
