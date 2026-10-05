import { routing } from '@/i18n/routing';

import { HOME_PATH, LOGIN_PATH } from './constants';

const ORIGIN = 'http://vault.invalid';

/**
 * Sanitizes a post-login `next` target to a same-origin, locale-less path.
 * Rejects absolute URLs, protocol-relative URLs, backslash tricks and the login page itself.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next?.startsWith('/') || next.startsWith('//') || next.includes('\\')) return HOME_PATH;

  let url: URL;
  try {
    url = new URL(next, ORIGIN);
  } catch {
    return HOME_PATH;
  }
  if (url.origin !== ORIGIN) return HOME_PATH;

  const segments = url.pathname.split('/');
  const first = segments[1];
  if (first && (routing.locales as readonly string[]).includes(first)) segments.splice(1, 1);
  const pathname = segments.join('/') || '/';

  if (pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) return HOME_PATH;
  return `${pathname}${url.search}`;
}
