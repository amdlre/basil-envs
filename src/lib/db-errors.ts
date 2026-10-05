type PgLikeError = {
  code?: unknown;
  constraint_name?: unknown;
  constraint?: unknown;
  cause?: unknown;
};

function pgError(error: unknown): PgLikeError | null {
  let current: unknown = error;
  // Drizzle wraps driver errors in `cause`.
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth++) {
    const candidate = current as PgLikeError;
    if (typeof candidate.code === 'string') return candidate;
    current = candidate.cause;
  }
  return null;
}

/** True for a Postgres unique violation (23505), optionally on a specific constraint. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pg = pgError(error);
  if (pg?.code !== '23505') return false;
  if (!constraint) return true;
  return pg.constraint_name === constraint || pg.constraint === constraint;
}
