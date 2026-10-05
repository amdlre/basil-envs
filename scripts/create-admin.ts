/**
 * Creates the single admin user, or resets its password.
 *
 *   npm run create-admin -- --email admin@example.com
 *   npm run create-admin -- --email admin@example.com --reset
 *
 * Password is read from a hidden prompt, or from ADMIN_PASSWORD for non-interactive use
 * (e.g. `docker compose run`). Resetting the password signs out every existing session.
 */
import { parseArgs } from 'node:util';

import { count, eq } from 'drizzle-orm';
import { z } from 'zod';

import { closeDb, getDb } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/auth/password-rules';

const argsSchema = z.object({
  email: z.string().trim().toLowerCase().email('--email must be a valid email address'),
  reset: z.boolean(),
});

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);

/** Reads a line from the TTY without echoing it. */
function promptHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) {
    return Promise.reject(
      new Error('No TTY available — set ADMIN_PASSWORD to run non-interactively.'),
    );
  }

  return new Promise((resolve, reject) => {
    let value = '';
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      stdout.write('\n');
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          cleanup();
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          cleanup();
          reject(new Error('Aborted'));
          return;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };

    stdin.on('data', onData);
  });
}

async function readPassword(): Promise<string> {
  const fromEnv = process.env.ADMIN_PASSWORD;
  if (fromEnv) return passwordSchema.parse(fromEnv);

  const first = passwordSchema.parse(await promptHidden('Password: '));
  const second = await promptHidden('Confirm password: ');
  if (first !== second) throw new Error('Passwords do not match');
  return first;
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      reset: { type: 'boolean', default: false },
    },
    strict: true,
  });
  const { email, reset } = argsSchema.parse(values);
  const db = getDb();

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  const [totals] = await db.select({ n: count() }).from(users);
  const userCount = totals?.n ?? 0;

  if (existing && !reset) {
    throw new Error(`Admin ${email} already exists. Re-run with --reset to change its password.`);
  }
  if (!existing && reset) throw new Error(`No admin with email ${email}.`);
  if (!existing && userCount > 0) {
    throw new Error('This vault supports a single admin, and one already exists.');
  }

  const passwordHash = await hashPassword(await readPassword());

  if (existing) {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, existing.id));
      await tx.insert(auditLogs).values({
        action: 'admin.password_reset',
        entity: 'user',
        entityId: existing.id,
        metadata: { via: 'cli' },
      });
    });
    console.info(`✓ Password reset for ${email}. All existing sessions are now signed out.`);
    return;
  }

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id });
    await tx.insert(auditLogs).values({
      action: 'admin.created',
      entity: 'user',
      entityId: created?.id ?? null,
      metadata: { via: 'cli' },
    });
  });
  console.info(`✓ Admin ${email} created.`);
}

main()
  .catch((error: unknown) => {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((i) => i.message).join('\n')
        : error instanceof Error
          ? error.message
          : String(error);
    console.error(`✗ ${message}`);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
