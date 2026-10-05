import 'server-only';

import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { auditLogs, projects } from '@/db/schema';
import { serializeEnv } from '@/lib/env-parser';

import { loadEnvironment, loadStoredVariables, openValue } from './store';

export type EnvExport = { fileName: string; content: string; count: number };

/** `.env.local`, `.env.production`, … — the conventional per-environment file name. */
export const envFileName = (typeSlug: string) => `.env.${typeSlug}`;

/** Decrypts an environment into `.env` text and records the export (keys count only). */
export async function exportEnvironment(environmentId: string): Promise<EnvExport | null> {
  const db = getDb();
  const env = await loadEnvironment(db, environmentId);
  if (!env) return null;

  const [project] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, env.projectId));
  const rows = await loadStoredVariables(db, env.id);
  const entries = rows.map((row) => ({ key: row.key, value: openValue(env.id, row) }));

  const content = serializeEnv(
    entries,
    `${project?.name ?? ''} — ${env.typeSlug}\nExported ${new Date().toISOString()} from Env Vault. Keep this file out of version control.`,
  );

  await db.insert(auditLogs).values({
    action: 'variables.exported',
    entity: 'environment',
    entityId: env.id,
    metadata: { projectId: env.projectId, environment: env.typeSlug, count: rows.length },
  });

  return { fileName: envFileName(env.typeSlug), content, count: rows.length };
}
