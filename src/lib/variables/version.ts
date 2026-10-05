import { createHash } from 'node:crypto';

/**
 * Optimistic-concurrency token for an environment's variables: changes whenever a row is
 * added, removed, renamed or re-encrypted. Contains no values.
 */
export function computeVersion(rows: { id: string; key: string; updatedAt: Date }[]): string {
  const canonical = [...rows]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => `${r.id}:${r.key}:${r.updatedAt.getTime()}`)
    .join('|');
  return createHash('sha256').update(canonical).digest('base64url').slice(0, 22);
}
