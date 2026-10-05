import { z } from 'zod';

import { verifySession } from '@/lib/auth/session';
import { DecryptionError } from '@/lib/crypto';
import { exportEnvironment } from '@/lib/variables/export';

import type { NextRequest } from 'next/server';

const paramsSchema = z.object({ environmentId: z.string().uuid() });

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' } as const;

const text = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...NO_STORE },
  });

/**
 * Downloads an environment as a `.env` file. Not covered by the proxy (API routes are
 * excluded), so it verifies the session itself. The session cookie is SameSite=Strict,
 * so cross-site links can't trigger an authenticated download.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ environmentId: string }> },
) {
  const session = await verifySession();
  if (!session) return text('Unauthorized', 401);

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return text('Not found', 404);

  let file;
  try {
    file = await exportEnvironment(parsed.data.environmentId);
  } catch (error) {
    if (error instanceof DecryptionError) return text('Unable to decrypt values', 409);
    throw error;
  }
  if (!file) return text('Not found', 404);

  return new Response(file.content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
      'X-Content-Type-Options': 'nosniff',
      ...NO_STORE,
    },
  });
}
