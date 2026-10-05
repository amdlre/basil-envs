# Env Vault · خزنة المتغيرات

A private, self-hosted vault that is the single source of truth for the environment variables of all your projects.

**Project → Environments → Variables.** For example, the project "Seerah" has the tabs Local, Staging and Production, and each tab has its own encrypted key/value list.

Arabic (RTL, default) and English · dark UI · single admin · values encrypted with AES-256-GCM.

---

## Contents

- [Features](#features)
- [Security model](#security-model)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Deploying with Docker Compose](#deploying-with-docker-compose)
- [Backups and recovery](#backups-and-recovery)
- [Rotating the master key](#rotating-the-master-key)
- [Audit log retention](#audit-log-retention)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

## Features

- **Projects**: card grid with search, variable counts and environment chips. New projects automatically get the catalog's _default_ environments (Local and Production).
- **Environment tabs**: always ordered by the catalog's lifecycle order, whatever order they were added in.
  - The **+** menu lists only catalog environments the project doesn't have yet.
  - _Protected_ environments can't be deleted. Deleting any other environment requires typing its name, in either language.
- **Variables editor**:
  - Masked values with reveal and copy. Keys are validated (`^[A-Z_][A-Z0-9_]*$`) and uppercased as you type.
  - Paste a `.env` into a key field to add many rows at once.
  - Renames, swaps and deletes are saved in one transaction, with an unsaved-changes warning and ⌘S / Ctrl+S to save.
- **Raw `.env` mode**:
  - Paste or edit a whole file and get line-numbered parse errors as you type.
  - The _server-side_ diff preview shows added, changed and removed keys.
  - Choose merge, or replace (keys missing from the file are deleted).
- **Copy from environment**: copy keys only (with empty values) or keys and values, with an optional overwrite and a preview first.
- **Download `.env`**: files are named after the environment (`.env.local`, `.env.production`, …).
- **Compare**: a keys × environments matrix showing which keys each environment is missing.
- **Activity log**: every sign-in, change, reveal, copy and download, recorded with keys only and never values. Filterable and paginated.
- **Settings → Environment catalog**: add, edit, reorder and delete environment types (18 lifecycle types are seeded).
- **Bilingual**: Arabic (default, RTL) and English (LTR). Keys and values are always displayed left-to-right.

## Security model

| Concern                     | How it's handled                                                                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Encryption at rest          | Every value is encrypted with **AES-256-GCM** (`node:crypto`) using a unique 96-bit IV and a 128-bit auth tag.                                                                                                         |
| Row binding                 | Each ciphertext is authenticated with `environmentId:KEY` as AAD, so a ciphertext copied into another row (or under another key name) fails to decrypt.                                                                |
| Master key                  | `MASTER_ENCRYPTION_KEY` (32 bytes, base64) lives **only** in the server environment and is never stored in the database.                                                                                               |
| Values reaching the browser | Pages receive keys only. A value is decrypted server-side only when you reveal, copy, load Raw mode or download. Each of these is audit-logged. Raw-mode diffs are computed on the server.                             |
| Audit log                   | Records keys, project and environment names, IPs for sign-ins, and counts. **Never values.**                                                                                                                           |
| Authentication              | One admin. Passwords are hashed with argon2id (m=19 MiB, t=2, p=1). The session is an HS256 JWT in an `httpOnly`, `Secure`, `SameSite=Strict`, `__Host-` cookie that lasts 12 hours with no sliding renewal.           |
| Session invalidation        | The JWT carries a password fingerprint, so changing the password signs out every session. Every page and Server Action re-checks the session against the database. The proxy check is only a first, optimistic filter. |
| Brute force                 | Sign-in is limited to 5 failures per email and 20 per IP within 15 minutes. Failures are stored in the audit log, so the limit survives restarts.                                                                      |
| CSRF                        | `SameSite=Strict` cookies, plus Next.js Server Action origin checks.                                                                                                                                                   |
| Concurrency                 | Saves lock the environment row and verify a version token. A stale tab gets a "reload" error instead of silently overwriting.                                                                                          |
| Headers                     | CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, and `noindex`.                                                                                      |

> **CSP note:** Next.js inline bootstrap scripts and the design system's injected theme need `'unsafe-inline'` for scripts and styles. A per-request nonce CSP is possible via `src/proxy.ts` if you need it.

## Local development

**Prerequisites:** Node.js ≥ 20.9 and PostgreSQL ≥ 14.

```bash
npm ci
cp .env.example .env.local
```

Fill in `.env.local`:

```bash
openssl rand -base64 32   # → MASTER_ENCRYPTION_KEY
openssl rand -base64 48   # → JWT_SECRET
```

Create a database (adjust the role and password to match your `DATABASE_URL`):

```bash
psql -d postgres -c "create role vault login password 'change-me';" -c "create database vault owner vault;"
```

Then migrate, seed the catalog, create the admin, and run:

```bash
npm run db:migrate
npm run db:seed
npm run create-admin -- --email you@example.com   # prompts for the password (≥ 12 chars)
npm run dev
```

Open <http://localhost:3000>. `/` redirects to `/ar/projects`, and English lives under `/en/...`.

## Environment variables

| Variable                    | Required | Description                                                                                                           |
| --------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | ✅       | `postgres://user:pass@host:5432/db`                                                                                   |
| `MASTER_ENCRYPTION_KEY`     | ✅       | 32 random bytes, base64 (`openssl rand -base64 32`). **Back it up separately**; see [Backups](#backups-and-recovery). |
| `JWT_SECRET`                | ✅       | At least 32 characters. Changing it signs everyone out, and nothing else depends on it.                               |
| `NEXT_PUBLIC_APP_URL`       |          | Public URL of the app (default `http://localhost:3000`).                                                              |
| `APP_TIME_ZONE`             |          | IANA zone for displaying dates, e.g. `Asia/Riyadh` (default `UTC`).                                                   |
| `TEST_DATABASE_URL`         | tests    | Separate database for `npm run test:integration`. It is **truncated** on every run.                                   |
| `AUDIT_RETENTION_DAYS`      |          | Default retention for `prune-audit` (365).                                                                            |
| `OLD_MASTER_ENCRYPTION_KEY` | rotation | Only used by `rotate-key`.                                                                                            |

The server validates its environment on first use and fails with a readable message (without echoing secrets) if anything is missing or malformed.

## Scripts

| Command                                                     | What it does                                                                              |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start`                           | Next.js (Turbopack)                                                                       |
| `npm run lint` · `typecheck` · `format`                     | ESLint (strict, type-aware) · `tsc` · Prettier                                            |
| `npm test`                                                  | Unit tests (no database needed)                                                           |
| `npm run test:integration`                                  | Server Actions against a real database (`TEST_DATABASE_URL`)                              |
| `npm run db:generate`                                       | Generate a SQL migration from `src/db/schema.ts`                                          |
| `npm run db:migrate`                                        | Apply pending migrations                                                                  |
| `npm run db:seed`                                           | Insert missing catalog types. Never overwrites your catalog edits.                        |
| `npm run db:studio`                                         | Drizzle Studio                                                                            |
| `npm run create-admin -- --email you@example.com [--reset]` | Create the single admin, or reset its password (`ADMIN_PASSWORD` for non-interactive use) |
| `npm run rotate-key [-- --dry-run]`                         | Re-encrypt every value under a new master key ([details](#rotating-the-master-key))       |
| `npm run prune-audit [-- --days 180]`                       | Delete old audit entries                                                                  |
| `npm run build:cli`                                         | Bundle the CLI scripts into `dist/cli/*.mjs` (used by the Docker image)                   |

## Deploying with Docker Compose

```bash
cp .env.docker.example .env       # fill in POSTGRES_PASSWORD, MASTER_ENCRYPTION_KEY, JWT_SECRET, …
docker compose up -d --build
docker compose exec app node cli/create-admin.mjs --email you@example.com
```

- On every start, the app container applies pending migrations and seeds missing catalog types, then starts the server. Both steps are idempotent and non-destructive.
- The app is published on **127.0.0.1:3000** only, and Postgres isn't published at all.
- `GET /api/health` reports database readiness and is wired into the image's `HEALTHCHECK`.
- **Upgrading:** `git pull && docker compose up -d --build`. Migrations run automatically.

### HTTPS is required

The session cookie is `Secure` with the `__Host-` prefix, so the browser only stores it over HTTPS. `http://localhost` and `http://127.0.0.1` are the exception, because browsers treat them as secure. Put a TLS-terminating reverse proxy in front, for example Caddy:

```caddyfile
vault.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

The reverse proxy must **overwrite** `X-Forwarded-For` (Caddy and most proxies do by default). The per-IP sign-in rate limit trusts that header. The per-email limit applies regardless.

If you put the app behind a proxy that rewrites the `Host` header, add your public origin to `experimental.serverActions.allowedOrigins` in `next.config.ts`.

## Backups and recovery

> ⚠️ **A database backup is useless without `MASTER_ENCRYPTION_KEY`.** Values are encrypted with it, and it is deliberately never stored in the database. Lose the key and the values are gone.

Back up **two things, separately**:

1. **The database.** It holds ciphertext, plus plaintext project names, environment names, variable _keys_ and the audit log.
2. **`MASTER_ENCRYPTION_KEY`.** Keep it in a password manager or secrets store, _not_ next to the database dumps. Someone holding both can decrypt everything.

`JWT_SECRET` doesn't need backing up. A new one only signs everybody out.

```bash
# Backup (custom format, compressed)
docker compose exec -T db pg_dump -U vault -Fc vault > "vault-$(date +%F).dump"

# Restore into an empty database (stop the app first)
docker compose stop app
docker compose exec -T db pg_restore -U vault -d vault --clean --if-exists < vault-2026-10-05.dump
docker compose start app
```

Recommendations:

- Encrypt the dump files at rest (e.g. `age`, `gpg`, or encrypted object storage). They contain key names and project structure.
- Automate dumps (cron or systemd timer) and **test a restore** periodically. Start a scratch instance with the backup _and_ the key, then reveal a value.
- Keep old master keys for as long as you keep backups taken with them (see rotation below).

## Rotating the master key

Rotation re-encrypts every value inside **one transaction**. Each new ciphertext is verified before commit, and any failure rolls everything back. Values stay bound to their rows.

```bash
docker compose stop app            # no writes during rotation

CURRENT=$(grep '^MASTER_ENCRYPTION_KEY=' .env | cut -d= -f2-)
NEW=$(openssl rand -base64 32)
docker compose run --rm -e OLD_MASTER_ENCRYPTION_KEY="$CURRENT" -e MASTER_ENCRYPTION_KEY="$NEW" \
  app node cli/rotate-key.mjs --dry-run
docker compose run --rm -e OLD_MASTER_ENCRYPTION_KEY="$CURRENT" -e MASTER_ENCRYPTION_KEY="$NEW" \
  app node cli/rotate-key.mjs

# Put $NEW into .env as MASTER_ENCRYPTION_KEY, then:
docker compose up -d
```

Locally: `OLD_MASTER_ENCRYPTION_KEY=… MASTER_ENCRYPTION_KEY=… npm run rotate-key`. Keep the old key until you've confirmed that revealing works and that no backups still depend on it.

## Audit log retention

Audit entries are kept until pruned. Rate limiting only needs the last 15 minutes, so pruning is always safe.

```bash
npm run prune-audit -- --days 180                               # local
docker compose exec app node cli/prune-audit.mjs --days 180     # Docker
# e.g. weekly via cron:
# 0 3 * * 0  cd /srv/env-vault && docker compose exec -T app node cli/prune-audit.mjs
```

## Testing

```bash
npm test                    # unit tests: crypto, .env parser (incl. randomized round-trips), plan/diff logic, auth, proxy
npm run test:integration    # real Server Actions + Postgres: projects, environments, variables, copy-from, download, audit, catalog, key rotation
```

Integration tests need `TEST_DATABASE_URL` pointing at a **separate** database (they refuse to run against `DATABASE_URL`). Only the session and router refresh are mocked.

## Project structure

```
src/
  app/[locale]/(auth)/login         sign-in
  app/[locale]/(dashboard)/         projects, projects/[slug] (+ /compare), activity, settings/environments
  app/api/                          health, environments/[id]/download, auth/session-expired
  actions/                          Server Actions (auth, projects, environments, variables, copy-from, catalog)
  db/                               schema.ts, migrations/, seed, queries/ (session-checked data access)
  lib/crypto/                       AES-256-GCM encrypt/decrypt (+ row-binding AAD)
  lib/auth/                         JWT tokens, sessions, argon2, rate limiting, safe redirects
  lib/env-parser/                   .env parse & serialize
  lib/variables/                    change plans, encrypted store, commits, copy, export, key rotation
  lib/validations/                  Zod schemas (messages are translation keys)
  components/                       project/, environment/, variables/, catalog/, compare/, activity/
  i18n/, messages/{ar,en}.json      next-intl (typed messages)
  proxy.ts                          locale routing + optimistic auth (Next 16's replacement for middleware.ts)
scripts/                            create-admin, rotate-key, prune-audit, build-cli
docker/entrypoint.sh, Dockerfile, docker-compose.yml
```

## Troubleshooting

| Symptom                                             | Cause / fix                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Sign-in "works" but you land back on the login page | The app is served over plain HTTP on a non-localhost address, so the browser drops the `Secure` cookie. Use HTTPS (see above). |
| "Couldn't decrypt" when revealing                   | `MASTER_ENCRYPTION_KEY` differs from the key the values were encrypted with (e.g. restored from a backup with another key).    |
| "These variables were changed elsewhere"            | Another tab saved first. Reload to get the latest version.                                                                     |
| "Too many failed attempts"                          | Wait 15 minutes, or reset the password with `create-admin --reset`.                                                            |
| `Invalid server environment` on start               | A required variable is missing or malformed. The message names it.                                                             |
