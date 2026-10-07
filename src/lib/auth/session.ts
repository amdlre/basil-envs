import 'server-only';

import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect as nextRedirect } from 'next/navigation';
import { locale as rootLocale } from 'next/root-params';
import { cache } from 'react';

import { getDb } from '@/db';
import { users } from '@/db/schema';
import { redirect } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

import {
  EXPIRED_SESSION_COOKIE,
  LOGIN_PATH,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_TTL_SECONDS,
} from './constants';
import { passwordFingerprint } from './password';
import { signSessionToken, verifySessionToken } from './tokens';

export type Session = { userId: string; email: string };

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export async function createSession(user: { id: string; passwordHash: string }): Promise<void> {
  const token = await signSessionToken({
    sub: user.id,
    pwv: passwordFingerprint(user.passwordHash),
  });

  (await cookies()).set(SESSION_COOKIE, token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: SESSION_TTL_SECONDS,
    priority: 'high',
  });
}

export async function deleteSession(): Promise<void> {
  (await cookies()).set(EXPIRED_SESSION_COOKIE);
}

/**
 * Full session check (data access layer): valid JWT + user still exists + password
 * unchanged since the token was issued. Memoized per request.
 */
export const verifySession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const [user] = await getDb()
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, claims.sub))
    .limit(1);

  if (!user || passwordFingerprint(user.passwordHash) !== claims.pwv) return null;
  return { userId: user.id, email: user.email };
});

/** For Server Components: redirects to the localized login page when unauthenticated. */
export async function requireSession(): Promise<Session> {
  const session = await verifySession();
  if (session) return session;

  const param = await rootLocale();
  const locale = routing.locales.find((l) => l === param) ?? routing.defaultLocale;

  // A cookie that passed the proxy's JWT check but failed here is stale: clear it first.
  if ((await cookies()).has(SESSION_COOKIE)) {
    nextRedirect(`/api/auth/session-expired?locale=${locale}`);
  }
  return redirect({ href: LOGIN_PATH, locale });
}

/** For Server Actions / Route Handlers: throws `UnauthorizedError` when unauthenticated. */
export async function assertSession(): Promise<Session> {
  const session = await verifySession();
  if (!session) throw new UnauthorizedError();
  return session;
}
