import { NextResponse, type NextRequest } from 'next/server';

import { routing } from '@/i18n/routing';
import { LOGIN_PATH, SESSION_COOKIE } from '@/lib/auth/constants';

/**
 * Reached when a session JWT is still validly signed but no longer valid server-side
 * (user deleted or password changed). Server Components can't modify cookies, so this
 * handler clears the stale cookie — otherwise the proxy would bounce /login → /projects
 * → /login forever.
 */
export function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get('locale');
  const locale = routing.locales.find((l) => l === param) ?? routing.defaultLocale;

  const response = NextResponse.redirect(new URL(`/${locale}${LOGIN_PATH}`, request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
