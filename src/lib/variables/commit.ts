import 'server-only';

import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { auditLogs, projects } from '@/db/schema';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { DecryptionError } from '@/lib/crypto';

import { isEmptyPlan, prunePlan, validatePlan, type VariablePlan } from './plan';
import {
  applyPlan,
  loadEnvironment,
  loadStoredVariables,
  versionOf,
  type AppliedChanges,
  type EnvironmentContext,
  type StoredVariable,
  type Tx,
} from './store';

export type SaveSummary = { created: number; updated: number; renamed: number; deleted: number };

const summarize = (c: AppliedChanges): SaveSummary => ({
  created: c.created.length,
  updated: c.updated.length,
  renamed: c.renamed.length,
  deleted: c.deleted.length,
});

type PlanBuilder = (context: {
  tx: Tx;
  env: EnvironmentContext;
  rows: StoredVariable[];
}) => VariablePlan | ActionResult<never> | Promise<VariablePlan | ActionResult<never>>;

const isActionResult = (value: unknown): value is ActionResult<never> =>
  typeof value === 'object' && value !== null && 'ok' in value;

/**
 * Locks the environment, checks the optimistic version, validates and applies the plan,
 * and writes one audit entry (keys only — never values). A builder may short-circuit by
 * returning a failed ActionResult.
 */
export async function commitPlan(
  environmentId: string,
  version: string,
  buildPlan: PlanBuilder,
  auditAction: string,
  auditExtra: Record<string, unknown> = {},
): Promise<ActionResult<SaveSummary>> {
  return getDb().transaction(async (tx) => {
    const env = await loadEnvironment(tx, environmentId, { lock: true });
    if (!env) return fail('notFound');

    const rows = await loadStoredVariables(tx, environmentId);
    if (versionOf(rows) !== version) return fail('stale');

    const built = await buildPlan({ tx, env, rows });
    if (isActionResult(built)) return built;

    const plan = prunePlan(rows, built);
    const errors = validatePlan(rows, plan);
    if (Object.keys(errors).length > 0) return fail('validation', errors);
    if (isEmptyPlan(plan)) return ok({ created: 0, updated: 0, renamed: 0, deleted: 0 });

    const changes = await applyPlan(tx, environmentId, rows, plan);
    await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, env.projectId));
    await tx.insert(auditLogs).values({
      action: auditAction,
      entity: 'environment',
      entityId: environmentId,
      metadata: { projectId: env.projectId, environment: env.typeSlug, ...changes, ...auditExtra },
    });
    return ok(summarize(changes));
  });
}

/** Maps a decryption failure (e.g. changed master key) to a typed action error. */
export function withDecryptionGuard<T>(
  run: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  return run().catch((error: unknown) => {
    if (error instanceof DecryptionError) return fail('decryptionFailed');
    throw error;
  });
}
