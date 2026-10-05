'use server';

import { eq } from 'drizzle-orm';
import { refresh } from 'next/cache';

import { getDb } from '@/db';
import { auditLogs, environments, environmentTypes, envVariables } from '@/db/schema';
import { fail, ok } from '@/lib/action-result';
import { DecryptionError } from '@/lib/crypto';
import { parseEnv, serializeEnv, type ParseIssue, type ParseWarning } from '@/lib/env-parser';
import { authedAction } from '@/lib/safe-action';
import { zodFieldErrors } from '@/lib/validations/utils';
import {
  applyRawSchema,
  environmentRefSchema,
  rawContentSchema,
  revealVariableSchema,
  saveVariablesSchema,
} from '@/lib/validations/variables';
import { commitPlan, withDecryptionGuard } from '@/lib/variables/commit';
import { buildRawPlan, validatePlan, type RawDiff } from '@/lib/variables/plan';
import {
  loadEnvironment,
  loadStoredVariables,
  openValue,
  versionOf,
  type EnvironmentContext,
  type StoredVariable,
} from '@/lib/variables/store';

// ─── Editor ──────────────────────────────────────────────────────────────────

export const saveVariablesAction = authedAction(async (_session, input: unknown) => {
  const parsed = saveVariablesSchema.safeParse(input);
  if (!parsed.success) return fail('validation', zodFieldErrors(parsed.error));

  const { environmentId, version, creates, updates, deletes } = parsed.data;
  const result = await withDecryptionGuard(() =>
    commitPlan(environmentId, version, () => ({ creates, updates, deletes }), 'variables.saved'),
  );
  if (result.ok) refresh();
  return result;
});

export const revealVariableAction = authedAction(async (_session, input: unknown) => {
  const parsed = revealVariableSchema.safeParse(input);
  if (!parsed.success) return fail('validation');

  const { variableId, purpose } = parsed.data;
  const db = getDb();
  const [row] = await db
    .select({
      id: envVariables.id,
      key: envVariables.key,
      encryptedValue: envVariables.encryptedValue,
      iv: envVariables.iv,
      authTag: envVariables.authTag,
      updatedAt: envVariables.updatedAt,
      environmentId: envVariables.environmentId,
      projectId: environments.projectId,
      typeSlug: environmentTypes.slug,
    })
    .from(envVariables)
    .innerJoin(environments, eq(envVariables.environmentId, environments.id))
    .innerJoin(environmentTypes, eq(environments.typeId, environmentTypes.id))
    .where(eq(envVariables.id, variableId));
  if (!row) return fail('notFound');

  let value: string;
  try {
    value = openValue(row.environmentId, row);
  } catch (error) {
    if (error instanceof DecryptionError) return fail('decryptionFailed');
    throw error;
  }

  await db.insert(auditLogs).values({
    action: purpose === 'copy' ? 'variable.copied' : 'variable.revealed',
    entity: 'variable',
    entityId: row.id,
    metadata: { key: row.key, projectId: row.projectId, environment: row.typeSlug },
  });
  return ok({ value });
});

// ─── Raw (.env) mode ─────────────────────────────────────────────────────────

function decryptAll(env: EnvironmentContext, rows: StoredVariable[]) {
  return rows.map((row) => ({ id: row.id, key: row.key, value: openValue(env.id, row) }));
}

/** Explicit "reveal all" for editing the whole file. Audited. */
export const loadRawAction = authedAction(async (_session, input: unknown) => {
  const parsed = environmentRefSchema.safeParse(input);
  if (!parsed.success) return fail('validation');

  return withDecryptionGuard(async () => {
    const db = getDb();
    const env = await loadEnvironment(db, parsed.data.environmentId);
    if (!env) return fail('notFound');

    const rows = await loadStoredVariables(db, env.id);
    const content = serializeEnv(decryptAll(env, rows));
    await db.insert(auditLogs).values({
      action: 'variables.revealed_all',
      entity: 'environment',
      entityId: env.id,
      metadata: { projectId: env.projectId, environment: env.typeSlug, count: rows.length },
    });
    return ok({ content, version: versionOf(rows) });
  });
});

export type RawPreview = {
  errors: ParseIssue[];
  warnings: ParseWarning[];
  diff: RawDiff | null;
  /** Plan-level problems (e.g. too many variables), as translation keys. */
  problems: string[];
};

/** Server-side diff: compares against decrypted values without sending any back. */
export const previewRawAction = authedAction(async (_session, input: unknown) => {
  const parsed = rawContentSchema.safeParse(input);
  if (!parsed.success) return fail('validation');

  const { environmentId, content, removeMissing } = parsed.data;
  const { entries, errors, warnings } = parseEnv(content);
  if (errors.length > 0) return ok<RawPreview>({ errors, warnings, diff: null, problems: [] });

  return withDecryptionGuard(async () => {
    const db = getDb();
    const env = await loadEnvironment(db, environmentId);
    if (!env) return fail('notFound');

    const rows = await loadStoredVariables(db, env.id);
    const { plan, diff } = buildRawPlan(decryptAll(env, rows), entries, removeMissing);
    const problems = [...new Set(Object.values(validatePlan(rows, plan)))];
    return ok<RawPreview>({ errors, warnings, diff, problems });
  });
});

/** Re-parses and re-diffs on the server (never trusts the client's preview). */
export const applyRawAction = authedAction(async (_session, input: unknown) => {
  const parsed = applyRawSchema.safeParse(input);
  if (!parsed.success) return fail('validation');

  const { environmentId, content, removeMissing, version } = parsed.data;
  const { entries, errors } = parseEnv(content);
  if (errors.length > 0) return fail('validation', { _form: 'rawHasErrors' });

  const result = await withDecryptionGuard(() =>
    commitPlan(
      environmentId,
      version,
      ({ rows }) =>
        buildRawPlan(
          rows.map((row) => ({ id: row.id, key: row.key, value: openValue(environmentId, row) })),
          entries,
          removeMissing,
        ).plan,
      'variables.imported',
      { removeMissing },
    ),
  );
  if (result.ok) refresh();
  return result;
});
