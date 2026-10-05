import 'server-only';

import { requireSession } from '@/lib/auth/session';
import { loadStoredVariables, versionOf } from '@/lib/variables/store';

import { getDb } from '..';

/** What the client is allowed to see: never values or ciphertext. */
export type MaskedVariable = { id: string; key: string; updatedAt: Date };

export async function getMaskedVariables(
  environmentId: string,
): Promise<{ variables: MaskedVariable[]; version: string }> {
  await requireSession();
  const rows = await loadStoredVariables(getDb(), environmentId);
  return {
    variables: rows.map(({ id, key, updatedAt }) => ({ id, key, updatedAt })),
    version: versionOf(rows),
  };
}
