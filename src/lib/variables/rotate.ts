import 'server-only';

import { eq, sql } from 'drizzle-orm';

import type { Database } from '@/db';
import { envVariables } from '@/db/schema';
import { decrypt, encrypt, variableAad } from '@/lib/crypto';
import { assertKey } from '@/lib/crypto/key';

export type RotationResult = { rotated: number; dryRun: boolean };

/** Thrown to roll back a dry run after every row was rotated successfully. */
class DryRunRollback extends Error {}

/**
 * Re-encrypts every stored value from `oldKey` to `newKey` in ONE transaction, keeping each
 * value bound to its row (AAD). Every new ciphertext is verified before commit; any failure
 * rolls everything back, so the database is never left with mixed keys.
 * `updated_at` is left untouched: the values themselves didn't change.
 */
export async function rotateMasterKey(
  db: Database,
  oldKey: Buffer,
  newKey: Buffer,
  { dryRun = false } = {},
): Promise<RotationResult> {
  assertKey(oldKey);
  assertKey(newKey);
  if (oldKey.equals(newKey)) throw new Error('The new key must differ from the old key');

  let rotated = 0;
  try {
    await db.transaction(async (tx) => {
      // Block concurrent writers while values are in transit between keys.
      await tx.execute(sql`lock table ${envVariables} in exclusive mode`);
      const rows = await tx.select().from(envVariables);

      for (const row of rows) {
        const aad = variableAad(row.environmentId, row.key);
        const plaintext = decrypt(
          { ciphertext: row.encryptedValue, iv: row.iv, authTag: row.authTag },
          { aad, key: oldKey },
        );
        const sealed = encrypt(plaintext, { aad, key: newKey });
        if (decrypt(sealed, { aad, key: newKey }) !== plaintext) {
          throw new Error(`Verification failed for ${row.key}`);
        }
        await tx
          .update(envVariables)
          .set({ encryptedValue: sealed.ciphertext, iv: sealed.iv, authTag: sealed.authTag })
          .where(eq(envVariables.id, row.id));
        rotated++;
      }
      if (dryRun) throw new DryRunRollback(); // roll back after proving every row rotates
    });
  } catch (error) {
    if (!(error instanceof DryRunRollback)) throw error;
  }
  return { rotated, dryRun };
}
