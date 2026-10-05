import 'server-only';

import { and, count, eq, gte, sql } from 'drizzle-orm';

import { getDb } from '@/db';
import { auditLogs } from '@/db/schema';

export const LOGIN_WINDOW_MINUTES = 15;
export const MAX_FAILURES_PER_EMAIL = 5;
export const MAX_FAILURES_PER_IP = 20;

export const LOGIN_FAILED_ACTION = 'auth.login_failed';

/**
 * Login throttling backed by `audit_logs` failed-login entries, so limits survive
 * restarts and work across multiple app instances without extra infrastructure.
 */
export async function isLoginRateLimited(email: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000);
  const db = getDb();

  const [row] = await db
    .select({
      byEmail: count(sql`case when ${auditLogs.metadata}->>'email' = ${email} then 1 end`),
      byIp: count(sql`case when ${auditLogs.metadata}->>'ip' = ${ip} then 1 end`),
    })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, LOGIN_FAILED_ACTION), gte(auditLogs.createdAt, since)));

  return (row?.byEmail ?? 0) >= MAX_FAILURES_PER_EMAIL || (row?.byIp ?? 0) >= MAX_FAILURES_PER_IP;
}
