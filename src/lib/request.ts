import 'server-only';

import { headers } from 'next/headers';

/**
 * Best-effort client IP. Only trustworthy when the app sits behind a reverse proxy
 * that overwrites X-Forwarded-For / X-Real-IP (see README → Deployment).
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const candidates = [h.get('x-forwarded-for')?.split(',')[0], h.get('x-real-ip')];
  return candidates.map((value) => value?.trim()).find((value) => value) ?? 'unknown';
}
