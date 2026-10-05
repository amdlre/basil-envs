import 'server-only';

import { eq, inArray } from 'drizzle-orm';

import type { Database } from '@/db';
import { environments, environmentTypes, envVariables } from '@/db/schema';
import { decrypt, encrypt, variableAad } from '@/lib/crypto';

import { computeVersion } from './version';

import type { VariablePlan } from './plan';

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Executor = Database | Tx;

export type StoredVariable = {
  id: string;
  key: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
  updatedAt: Date;
};

export type EnvironmentContext = { id: string; projectId: string; typeSlug: string };

const storedColumns = {
  id: envVariables.id,
  key: envVariables.key,
  encryptedValue: envVariables.encryptedValue,
  iv: envVariables.iv,
  authTag: envVariables.authTag,
  updatedAt: envVariables.updatedAt,
};

/** Loads the environment (optionally row-locking it to serialize concurrent writers). */
export async function loadEnvironment(
  db: Executor,
  environmentId: string,
  { lock = false } = {},
): Promise<EnvironmentContext | null> {
  const query = db
    .select({
      id: environments.id,
      projectId: environments.projectId,
      typeSlug: environmentTypes.slug,
    })
    .from(environments)
    .innerJoin(environmentTypes, eq(environments.typeId, environmentTypes.id))
    .where(eq(environments.id, environmentId));
  const [row] = lock ? await query.for('update', { of: environments }) : await query;
  return row ?? null;
}

export async function loadStoredVariables(
  db: Executor,
  environmentId: string,
): Promise<StoredVariable[]> {
  return db
    .select(storedColumns)
    .from(envVariables)
    .where(eq(envVariables.environmentId, environmentId))
    .orderBy(envVariables.key);
}

export const versionOf = (rows: StoredVariable[]) => computeVersion(rows);

/** Encrypts with AAD `${environmentId}:${key}` — ciphertext is bound to its row. */
export function sealValue(environmentId: string, key: string, plaintext: string) {
  const sealed = encrypt(plaintext, { aad: variableAad(environmentId, key) });
  return { encryptedValue: sealed.ciphertext, iv: sealed.iv, authTag: sealed.authTag };
}

export function openValue(environmentId: string, row: StoredVariable): string {
  return decrypt(
    { ciphertext: row.encryptedValue, iv: row.iv, authTag: row.authTag },
    { aad: variableAad(environmentId, row.key) },
  );
}

export type AppliedChanges = {
  created: string[];
  updated: string[];
  renamed: { from: string; to: string }[];
  deleted: string[];
};

/**
 * Applies a validated plan inside a transaction. Renames go through temporary keys so that
 * swaps (A↔B) never collide with the UNIQUE(environment_id, key) constraint, and renamed
 * values are re-encrypted under their new AAD.
 */
export async function applyPlan(
  tx: Tx,
  environmentId: string,
  rows: StoredVariable[],
  plan: VariablePlan,
): Promise<AppliedChanges> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const now = new Date();
  const changes: AppliedChanges = { created: [], updated: [], renamed: [], deleted: [] };

  if (plan.deletes.length > 0) {
    await tx.delete(envVariables).where(inArray(envVariables.id, plan.deletes));
    for (const id of plan.deletes) {
      const row = byId.get(id);
      if (row) changes.deleted.push(row.key);
    }
  }

  const renames = plan.updates.filter((u) => byId.get(u.id)?.key !== u.key);
  for (const [index, update] of renames.entries()) {
    await tx
      .update(envVariables)
      .set({ key: `__RENAMING_${index}_${update.id.replace(/-/g, '').slice(0, 12).toUpperCase()}` })
      .where(eq(envVariables.id, update.id));
  }

  for (const update of plan.updates) {
    const current = byId.get(update.id);
    if (!current) continue;
    const plaintext = update.value ?? openValue(environmentId, current);
    await tx
      .update(envVariables)
      .set({ key: update.key, ...sealValue(environmentId, update.key, plaintext), updatedAt: now })
      .where(eq(envVariables.id, update.id));

    if (current.key !== update.key) changes.renamed.push({ from: current.key, to: update.key });
    if (update.value !== undefined) changes.updated.push(update.key);
  }

  if (plan.creates.length > 0) {
    await tx.insert(envVariables).values(
      plan.creates.map((c) => ({
        environmentId,
        key: c.key,
        ...sealValue(environmentId, c.key, c.value),
        createdAt: now,
        updatedAt: now,
      })),
    );
    changes.created.push(...plan.creates.map((c) => c.key));
  }

  return changes;
}
