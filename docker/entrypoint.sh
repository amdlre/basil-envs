#!/bin/sh
# Default: apply pending migrations and seed missing catalog types (both idempotent and
# non-destructive), then start the Next.js standalone server as PID 1.
#
# With arguments, run that command instead, e.g. one-off maintenance:
#   docker compose run --rm app node cli/rotate-key.mjs --dry-run
set -eu

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

node cli/migrate.mjs
node cli/seed.mjs

exec node server.js
