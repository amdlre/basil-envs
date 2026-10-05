import 'server-only';

import { unstable_rethrow } from 'next/navigation';

import { fail, type ActionResult } from '@/lib/action-result';
import { assertSession, UnauthorizedError, type Session } from '@/lib/auth/session';

/**
 * Wraps a Server Action body: verifies the session first (never trust the proxy alone),
 * maps auth failures to `unauthorized`, lets Next.js control-flow errors (redirect,
 * notFound) through, and hides unexpected errors behind `unknown`.
 */
export function authedAction<TArgs extends unknown[], TData>(
  handler: (session: Session, ...args: TArgs) => Promise<ActionResult<TData>>,
): (...args: TArgs) => Promise<ActionResult<TData>> {
  return async (...args: TArgs) => {
    try {
      const session = await assertSession();
      return await handler(session, ...args);
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof UnauthorizedError) return fail('unauthorized');
      console.error('[action] unexpected error', error);
      return fail('unknown');
    }
  };
}
