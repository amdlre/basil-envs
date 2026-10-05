import type { VariablePlan } from './plan';

export type CopyMode = 'keys' | 'values';

export type CopySummary = {
  /** Keys that will be created in the target. */
  add: string[];
  /** Existing target keys whose value will be replaced. */
  overwrite: string[];
  /** Source keys left alone (already in the target, not overwritten or identical). */
  skip: string[];
};

type TargetRow = { id: string; key: string; value?: string };

/**
 * Plans copying `source` into `target`:
 *  - `keys`: create missing keys with empty values; never touch existing ones.
 *  - `values`: create missing keys with their values; with `overwrite`, also replace
 *    existing values that differ.
 * Target values are only needed for `values` + `overwrite` (to skip identical ones).
 */
export function buildCopyPlan(
  target: TargetRow[],
  source: { key: string; value: string }[],
  mode: CopyMode,
  overwrite: boolean,
): { plan: VariablePlan; summary: CopySummary } {
  const byKey = new Map(target.map((row) => [row.key, row]));
  const plan: VariablePlan = { creates: [], updates: [], deletes: [] };
  const summary: CopySummary = { add: [], overwrite: [], skip: [] };

  for (const entry of [...source].sort((a, b) => a.key.localeCompare(b.key))) {
    const existing = byKey.get(entry.key);
    if (!existing) {
      plan.creates.push({
        ref: `copy:${entry.key}`,
        key: entry.key,
        value: mode === 'values' ? entry.value : '',
      });
      summary.add.push(entry.key);
    } else if (mode === 'values' && overwrite && existing.value !== entry.value) {
      plan.updates.push({
        ref: `copy:${entry.key}`,
        id: existing.id,
        key: entry.key,
        value: entry.value,
      });
      summary.overwrite.push(entry.key);
    } else {
      summary.skip.push(entry.key);
    }
  }
  return { plan, summary };
}
