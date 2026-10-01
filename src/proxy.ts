import createMiddleware from 'next-intl/middleware';

import { routing } from '@/i18n/routing';

import type { NextRequest } from 'next/server';

// Single proxy (formerly middleware.ts in Next ≤15) for locale routing.
// Auth protection is layered on here in phase 3.
const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
  return intlMiddleware(request);
}

export const config = {
  // Skip API routes, Next internals, and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
