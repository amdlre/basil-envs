import 'server-only';

import { getDb } from '@/db';
import { auditLogs } from '@/db/schema';

export type AuditEntry = {
  action: string;
  entity: string;
  entityId?: string | null;
  /** Never put secret values here. */
  metadata?: Record<string, unknown>;
};

/** Best-effort audit write: failures are reported but never break the user action. */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await getDb()
      .insert(auditLogs)
      .values({
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ?? {},
      });
  } catch (error) {
    console.error('[audit] failed to write entry', entry.action, error);
  }
}
