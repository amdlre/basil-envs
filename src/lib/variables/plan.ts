import { isValidKey } from '@/lib/env-parser';
import type { ParsedEntry } from '@/lib/env-parser';

import { MAX_VALUE_LENGTH, MAX_VARIABLES_PER_ENVIRONMENT } from './limits';

/** `ref` identifies the source row (client row id, or `line:N` for raw imports) for errors. */
export type PlanCreate = { ref: string; key: string; value: string };
/** `value` omitted = keep the stored value (e.g. rename only). */
export type PlanUpdate = { ref: string; id: string; key: string; value?: string };

export type VariablePlan = {
  creates: PlanCreate[];
  updates: PlanUpdate[];
  deletes: string[];
};

export type ExistingVariable = { id: string; key: string };

export const FORM_ERROR = '_form';

/**
 * Validates a change set against the current rows. Returns field errors keyed
 * `${ref}.key` / `${ref}.value` (or `_form`), with translation-key messages.
 */
export function validatePlan(
  existing: ExistingVariable[],
  plan: VariablePlan,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const byId = new Map(existing.map((v) => [v.id, v]));
  const deleted = new Set(plan.deletes);
  const touched = new Set<string>();

  for (const id of plan.deletes) {
    if (!byId.has(id)) errors[FORM_ERROR] = 'staleRows';
  }
  for (const update of plan.updates) {
    if (!byId.has(update.id) || deleted.has(update.id) || touched.has(update.id)) {
      errors[FORM_ERROR] = 'staleRows';
    }
    touched.add(update.id);
  }

  const rows = [...plan.updates, ...plan.creates];
  for (const row of rows) {
    if (!isValidKey(row.key)) errors[`${row.ref}.key`] = row.key === '' ? 'required' : 'keyInvalid';
    if (row.value !== undefined && row.value.length > MAX_VALUE_LENGTH) {
      errors[`${row.ref}.value`] = 'valueTooLong';
    }
  }

  // Final key set: untouched existing rows + every update/create.
  const owners = new Map<string, string | null>(); // key → ref (null = untouched existing row)
  for (const row of existing) {
    if (!deleted.has(row.id) && !touched.has(row.id)) owners.set(row.key, null);
  }
  for (const row of rows) {
    if (!row.key) continue;
    if (owners.has(row.key)) {
      errors[`${row.ref}.key`] ??= 'keyDuplicate';
      const other = owners.get(row.key);
      if (other) errors[`${other}.key`] ??= 'keyDuplicate';
    } else {
      owners.set(row.key, row.ref);
    }
  }

  if (owners.size > MAX_VARIABLES_PER_ENVIRONMENT) errors[FORM_ERROR] = 'tooManyVariables';
  return errors;
}

/** Drops updates that change nothing (same key, value not provided). */
export function prunePlan(existing: ExistingVariable[], plan: VariablePlan): VariablePlan {
  const byId = new Map(existing.map((v) => [v.id, v]));
  return {
    ...plan,
    updates: plan.updates.filter((u) => u.value !== undefined || byId.get(u.id)?.key !== u.key),
  };
}

export const isEmptyPlan = (plan: VariablePlan) =>
  plan.creates.length === 0 && plan.updates.length === 0 && plan.deletes.length === 0;

export type RawDiff = {
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: number;
};

/**
 * Turns a parsed `.env` into a plan against the current (decrypted) values.
 * `removeMissing` = the file is the full desired state; otherwise it's a merge.
 */
export function buildRawPlan(
  existing: (ExistingVariable & { value: string })[],
  entries: ParsedEntry[],
  removeMissing: boolean,
): { plan: VariablePlan; diff: RawDiff } {
  const byKey = new Map(existing.map((v) => [v.key, v]));
  const plan: VariablePlan = { creates: [], updates: [], deletes: [] };
  const diff: RawDiff = { added: [], changed: [], removed: [], unchanged: 0 };
  const incoming = new Set<string>();

  for (const entry of entries) {
    incoming.add(entry.key);
    const current = byKey.get(entry.key);
    if (!current) {
      plan.creates.push({ ref: `line:${entry.line}`, key: entry.key, value: entry.value });
      diff.added.push(entry.key);
    } else if (current.value !== entry.value) {
      plan.updates.push({
        ref: `line:${entry.line}`,
        id: current.id,
        key: entry.key,
        value: entry.value,
      });
      diff.changed.push(entry.key);
    } else {
      diff.unchanged++;
    }
  }

  if (removeMissing) {
    for (const row of existing) {
      if (!incoming.has(row.key)) {
        plan.deletes.push(row.id);
        diff.removed.push(row.key);
      }
    }
  }

  const byName = (a: string, b: string) => a.localeCompare(b);
  diff.added.sort(byName);
  diff.changed.sort(byName);
  diff.removed.sort(byName);
  return { plan, diff };
}
