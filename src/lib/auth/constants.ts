/** `__Host-` prefix pins the cookie to this exact origin over HTTPS (production only). */
export const SESSION_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-vault_session' : 'vault_session';

/** Absolute session lifetime (no sliding renewal). */
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

/** Attributes used both to set and to clear the session cookie. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
} as const;

/**
 * Expires the session cookie. Never use `cookies.delete()` for it: that omits `Secure`, and
 * browsers ignore any Set-Cookie for a `__Host-` cookie without `Secure` — the session would
 * survive "sign out" in production.
 */
export const EXPIRED_SESSION_COOKIE = {
  name: SESSION_COOKIE,
  value: '',
  ...SESSION_COOKIE_OPTIONS,
  maxAge: 0,
} as const;

export const JWT_ISSUER = 'env-vault';
export const JWT_AUDIENCE = 'env-vault:admin';

/** Paths (without locale prefix) reachable without a session. */
export const PUBLIC_PATHS = ['/login'] as const;

export const LOGIN_PATH = '/login';
export const HOME_PATH = '/projects';
