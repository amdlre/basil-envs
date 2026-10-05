/** Error codes are translated on the client via `errors.<code>`. */
export type ActionErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'invalidCredentials'
  | 'rateLimited'
  | 'notFound'
  | 'conflict'
  | 'forbidden'
  | 'unknown';

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: ActionErrorCode; fieldErrors?: Record<string, string> };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const fail = (
  error: ActionErrorCode,
  fieldErrors?: Record<string, string>,
): { ok: false; error: ActionErrorCode; fieldErrors?: Record<string, string> } =>
  fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
