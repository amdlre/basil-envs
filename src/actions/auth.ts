'use server';

import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { users } from '@/db/schema';
import { redirect } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { fail, type ActionResult } from '@/lib/action-result';
import { logAudit } from '@/lib/audit';
import { LOGIN_PATH } from '@/lib/auth/constants';
import { burnPasswordCheck, verifyPassword } from '@/lib/auth/password';
import { isLoginRateLimited, LOGIN_FAILED_ACTION } from '@/lib/auth/rate-limit';
import { safeNextPath } from '@/lib/auth/safe-redirect';
import { createSession, deleteSession, verifySession } from '@/lib/auth/session';
import { getClientIp } from '@/lib/request';
import { loginActionSchema } from '@/lib/validations/auth';
import { zodFieldErrors } from '@/lib/validations/utils';

export async function loginAction(input: unknown): Promise<ActionResult> {
  const parsed = loginActionSchema.safeParse(input);
  if (!parsed.success) return fail('validation', zodFieldErrors(parsed.error));

  const { email, password, locale, next } = parsed.data;
  const ip = await getClientIp();

  if (await isLoginRateLimited(email, ip)) {
    // Don't verify (or log) further attempts while blocked.
    return fail('rateLimited');
  }

  const [user] = await getDb()
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const valid = user ? await verifyPassword(user.passwordHash, password) : false;
  if (!user) await burnPasswordCheck(password);

  if (!user || !valid) {
    await logAudit({
      action: LOGIN_FAILED_ACTION,
      entity: 'user',
      entityId: user?.id ?? null,
      metadata: { email, ip, reason: user ? 'bad_password' : 'unknown_email' },
    });
    return fail('invalidCredentials');
  }

  await createSession(user);
  await logAudit({ action: 'auth.login', entity: 'user', entityId: user.id, metadata: { ip } });

  return redirect({ href: safeNextPath(next), locale });
}

export async function logoutAction(localeInput: unknown): Promise<void> {
  const locale = routing.locales.find((l) => l === localeInput) ?? routing.defaultLocale;
  const session = await verifySession();

  await deleteSession();
  if (session) {
    await logAudit({ action: 'auth.logout', entity: 'user', entityId: session.userId });
  }

  redirect({ href: LOGIN_PATH, locale });
}
