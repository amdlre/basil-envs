import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { routing, type Locale } from '@/i18n/routing';
import {
  EXPIRED_SESSION_COOKIE,
  HOME_PATH,
  LOGIN_PATH,
  PUBLIC_PATHS,
  SESSION_COOKIE,
} from '@/lib/auth/constants';
import { verifySessionToken } from '@/lib/auth/tokens';

const intlMiddleware = createMiddleware(routing);

function splitLocale(pathname: string): { locale: Locale | null; path: string } {
  const [, first, ...rest] = pathname.split('/');
  const locale = routing.locales.find((l) => l === first) ?? null;
  return locale ? { locale, path: `/${rest.join('/')}` } : { locale: null, path: pathname };
}

const isPublic = (path: string) => PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Single proxy (Next 16's replacement for middleware.ts) handling locale routing and
 * optimistic auth: verifies the JWT signature/expiry only — no DB. Pages and Server
 * Actions re-verify the session against the database (see lib/auth/session.ts).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { locale, path } = splitLocale(pathname);

  // No locale prefix yet → let next-intl redirect to /ar/... first.
  if (!locale) return intlMiddleware(request);

  // Server Action POSTs are authorized inside the action; redirecting them breaks the RPC.
  if (request.headers.has('next-action')) return intlMiddleware(request);

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session && !isPublic(path)) {
    const url = new URL(`/${locale}${LOGIN_PATH}`, request.url);
    if (path !== '/') url.searchParams.set('next', `${path}${search}`);
    const response = NextResponse.redirect(url);
    // Drop an invalid/expired cookie so it isn't re-sent on every request.
    if (request.cookies.has(SESSION_COOKIE)) response.cookies.set(EXPIRED_SESSION_COOKIE);
    return response;
  }

  if (session && isPublic(path)) {
    return NextResponse.redirect(new URL(`/${locale}${HOME_PATH}`, request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  // Skip API routes, Next internals, and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
