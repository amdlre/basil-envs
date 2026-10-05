import 'server-only';

import { z } from 'zod';

const base64Key32 = z
  .string({ required_error: 'MASTER_ENCRYPTION_KEY is required' })
  .trim()
  .refine((value) => /^[A-Za-z0-9+/]+={0,2}$/.test(value), 'must be base64')
  .refine(
    (value) => Buffer.from(value, 'base64').length === 32,
    'must decode to exactly 32 bytes (generate with: openssl rand -base64 32)',
  );

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL is required' })
    .url()
    .refine((url) => /^postgres(ql)?:\/\//.test(url), 'must be a postgres:// URL'),
  MASTER_ENCRYPTION_KEY: base64Key32,
  JWT_SECRET: z
    .string({ required_error: 'JWT_SECRET is required' })
    .min(32, 'must be at least 32 characters'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  APP_TIME_ZONE: z
    .string()
    .default('UTC')
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'must be an IANA time zone, e.g. Asia/Riyadh'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/**
 * Validated server environment. Parsed lazily (first call) so that `next build`
 * can run without secrets; fails fast with a readable message at first use.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid server environment:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
