# syntax=docker/dockerfile:1

# Debian slim (glibc) rather than Alpine: the argon2 native addon ships prebuilt glibc binaries.
FROM node:24-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ─── Dependencies (cached unless the lockfile changes) ───────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ─── Build: Next.js standalone server + bundled CLI scripts ──────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm run build:cli

# ─── Runtime: minimal, non-root ──────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    MIGRATIONS_DIR=/app/migrations

RUN groupadd --system --gid 1001 vault && useradd --system --uid 1001 --gid vault vault

COPY --from=build --chown=vault:vault /app/.next/standalone ./
COPY --from=build --chown=vault:vault /app/.next/static ./.next/static
COPY --from=build --chown=vault:vault /app/public ./public
COPY --from=build --chown=vault:vault /app/dist/cli ./cli
COPY --from=build --chown=vault:vault /app/src/db/migrations ./migrations
# argon2 loads its platform binary dynamically, which output tracing can miss.
COPY --from=build --chown=vault:vault /app/node_modules/@node-rs ./node_modules/@node-rs
COPY --chown=vault:vault docker/entrypoint.sh ./entrypoint.sh

USER vault
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./entrypoint.sh"]
