/**
 * Rotates MASTER_ENCRYPTION_KEY. Stop the app first, then:
 *
 *   OLD_MASTER_ENCRYPTION_KEY=<current> MASTER_ENCRYPTION_KEY=<new> npm run rotate-key -- --dry-run
 *   OLD_MASTER_ENCRYPTION_KEY=<current> MASTER_ENCRYPTION_KEY=<new> npm run rotate-key
 *
 * then start the app with the new MASTER_ENCRYPTION_KEY. Keep the old key until you've
 * verified the app can reveal values (and until backups taken with it have expired).
 */
import { parseArgs } from 'node:util';

import { closeDb, getDb } from '@/db';
import { auditLogs } from '@/db/schema';
import { getMasterKey } from '@/lib/crypto/key';
import { rotateMasterKey } from '@/lib/variables/rotate';

async function main() {
  const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
  const dryRun = values['dry-run'];

  const oldKeyB64 = process.env.OLD_MASTER_ENCRYPTION_KEY?.trim();
  if (!oldKeyB64) throw new Error('Set OLD_MASTER_ENCRYPTION_KEY to the key currently in use.');
  const oldKey = Buffer.from(oldKeyB64, 'base64');
  const newKey = getMasterKey(); // validated MASTER_ENCRYPTION_KEY (the new key)

  const { rotated } = await rotateMasterKey(getDb(), oldKey, newKey, { dryRun });
  if (dryRun) {
    console.info(`✓ Dry run: all ${rotated} values can be re-encrypted. Nothing was changed.`);
    return;
  }
  await getDb()
    .insert(auditLogs)
    .values({ action: 'admin.key_rotated', entity: 'system', metadata: { rotated, via: 'cli' } });
  console.info(`✓ Re-encrypted ${rotated} values with the new key. Restart the app with it now.`);
}

main()
  .catch((error: unknown) => {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
