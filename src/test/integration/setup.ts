import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, vi } from 'vitest';

import { closeDb, getDb } from '@/db';

import { DEFAULT_SESSION, session } from './session-state';

/**
 * Session + cache are framework concerns (cookies, router cache) — mocked so the real
 * Server Action logic runs against the real test database.
 */
vi.mock('@/lib/auth/session', async () => {
  const state = await import('./session-state');
  class UnauthorizedError extends Error {}
  const assertSession = vi.fn(() =>
    state.session.current
      ? Promise.resolve(state.session.current)
      : Promise.reject(new UnauthorizedError()),
  );
  return {
    UnauthorizedError,
    assertSession,
    requireSession: assertSession,
    verifySession: vi.fn(() => Promise.resolve(state.session.current)),
  };
});

vi.mock('next/cache', () => ({ refresh: vi.fn(), revalidatePath: vi.fn() }));

beforeEach(async () => {
  session.current = DEFAULT_SESSION;
  // Keep the seeded catalog; wipe everything else.
  await getDb().execute(sql`truncate projects, users, audit_logs restart identity cascade`);
});

afterAll(async () => {
  await closeDb();
});
