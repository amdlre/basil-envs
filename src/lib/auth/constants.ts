/** `__Host-` prefix pins the cookie to this exact origin over HTTPS (production only). */
export const SESSION_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-vault_session' : 'vault_session';

/** Absolute session lifetime (no sliding renewal). */
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export const JWT_ISSUER = 'env-vault';
export const JWT_AUDIENCE = 'env-vault:admin';

/** Paths (without locale prefix) reachable without a session. */
export const PUBLIC_PATHS = ['/login'] as const;

export const LOGIN_PATH = '/login';
export const HOME_PATH = '/projects';
