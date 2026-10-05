/**
 * Deletes audit entries older than N days (default: AUDIT_RETENTION_DAYS or 365).
 *
 *   npm run prune-audit -- --days 180
 *
 * Safe to run from cron: rate limiting only looks at the last 15 minutes of entries.
 */
import { parseArgs } from 'node:util';

import { lt } from 'drizzle-orm';

import { closeDb, getDb } from '@/db';
import { auditLogs } from '@/db/schema';

async function main() {
  const { values } = parseArgs({ options: { days: { type: 'string' } } });
  const days = Number(values.days ?? process.env.AUDIT_RETENTION_DAYS ?? 365);
  if (!Number.isInteger(days) || days < 1) throw new Error('--days must be a positive integer');

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const deleted = await getDb()
    .delete(auditLogs)
    .where(lt(auditLogs.createdAt, cutoff))
    .returning({ id: auditLogs.id });

  await getDb()
    .insert(auditLogs)
    .values({
      action: 'admin.audit_pruned',
      entity: 'system',
      metadata: { deleted: deleted.length, days },
    });
  console.info(`✓ Deleted ${deleted.length} audit entries older than ${days} days.`);
}

main()
  .catch((error: unknown) => {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
