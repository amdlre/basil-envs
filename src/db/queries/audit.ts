import 'server-only';

import { and, desc, eq, like, or, sql, type SQL } from 'drizzle-orm';

import { getDb } from '@/db';
import { auditLogs, projects } from '@/db/schema';
import type { AuditCategory } from '@/lib/audit/format';
import { requireSession } from '@/lib/auth/session';

export type AuditEntryRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  projectName: string | null;
  projectSlug: string | null;
};

export const AUDIT_PAGE_SIZE = 50;

const CATEGORY_FILTER: Record<AuditCategory, SQL | undefined> = {
  auth: or(like(auditLogs.action, 'auth.%'), like(auditLogs.action, 'admin.%')),
  projects: like(auditLogs.action, 'project.%'),
  environments: or(like(auditLogs.action, 'environment.%'), like(auditLogs.action, 'catalog.%')),
  variables: like(auditLogs.action, 'variable%'),
};

/**
 * Newest-first, keyset-paginated by (created_at, id). The cursor is an entry id, resolved
 * in SQL so microsecond timestamps never lose precision through JS Dates.
 */
export async function listAuditEntries({
  category,
  before,
}: {
  category: AuditCategory | null;
  before: string | null;
}): Promise<{ entries: AuditEntryRow[]; nextCursor: string | null }> {
  await requireSession();

  // Project for project events (entity_id) or anything carrying metadata.projectId.
  // Compared as text so malformed ids can never raise a cast error.
  const projectRef = sql`coalesce(${auditLogs.metadata}->>'projectId', case when ${auditLogs.entity} = 'project' then ${auditLogs.entityId} end)`;

  const conditions = [
    category ? CATEGORY_FILTER[category] : undefined,
    before
      ? sql`(${auditLogs.createdAt}, ${auditLogs.id}) < (select a.created_at, a.id from ${auditLogs} a where a.id = ${before})`
      : undefined,
  ].filter((c): c is SQL => c !== undefined);

  const rows = await getDb()
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      projectName: projects.name,
      projectSlug: projects.slug,
    })
    .from(auditLogs)
    .leftJoin(projects, eq(sql`${projects.id}::text`, projectRef))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(AUDIT_PAGE_SIZE + 1);

  const hasMore = rows.length > AUDIT_PAGE_SIZE;
  const entries = hasMore ? rows.slice(0, AUDIT_PAGE_SIZE) : rows;
  return { entries, nextCursor: hasMore ? (entries.at(-1)?.id ?? null) : null };
}
