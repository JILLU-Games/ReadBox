# syntax=docker/dockerfile:1.7

FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1. Install all build/runtime dependencies with layer caching
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci --no-audit --no-fund

# 2. Reproducible runtime dependencies from the SAME root npm lockfile.
# Prisma CLI and tsx are production dependencies because web startup/worker use them.
# Worker requires tsx@4.23.15 or newer; installed from the root lockfile.
FROM deps AS runtime-deps
RUN npm prune --omit=dev --no-audit --no-fund \
  && npx --no-install prisma generate

# 3. Build Next.js standalone production bundle
FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV AUTH_ENABLED=false
RUN npx prisma generate && npm run build

# 4. Compact, non-root production runtime image (serves both web and Maildir ingestion worker)
FROM base AS runner
RUN apk add --no-cache libc6-compat openssl

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs \
  && mkdir -p \
    /var/vmail \
    /var/lib/readbox/attachments \
    /var/lib/readbox/media \
    /var/lock/readbox-provision \
    /etc/opendkim/keys \
    /run/readbox \
    /run/vibmail \
  && chown -R nextjs:nodejs \
    /app \
    /var/vmail \
    /var/lib/readbox \
    /var/lock/readbox-provision \
    /etc/opendkim/keys \
    /run/readbox \
    /run/vibmail

# Copy worker/migration dependencies first, then Next.js standalone bundle
COPY --from=runtime-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Keep DATABASE_URL out of Compose interpolation. PostgreSQL passwords may contain
# '@', '#', '%', ':', '/' etc; URL(password) safely percent-encodes them at runtime.
RUN <<'READBOX_CREATE_WRAPPER'
cat > ./readbox-start.sh <<'READBOX_SCRIPT'
#!/bin/sh
set -eu
if [ -n "${READBOX_DB_PASSWORD:-}" ]; then
  DATABASE_URL="$(node -e '
    const e = process.env;
    const user = e.READBOX_DB_USER || "";
    const name = e.READBOX_DB_NAME || "";
    const password = e.READBOX_DB_PASSWORD || "";
    if (!/^[A-Za-z0-9_]+$/.test(user) || !/^[A-Za-z0-9_]+$/.test(name) || password.length < 24) {
      console.error("[readbox] Database credentials are missing, short, or invalid.");
      process.exit(1);
    }
    const url = new URL("postgresql://postgres:5432/");
    url.username = user;
    url.password = encodeURIComponent(password);
    url.pathname = "/" + name;
    url.searchParams.set("schema", "public");
    process.stdout.write(url.href);
  ')"
  export DATABASE_URL
fi
if [ "${NODE_ENV:-}" = "production" ] && [ "${#AUTH_SECRET}" -lt 32 ]; then
  echo "[readbox] AUTH_SECRET must be at least 32 characters." >&2
  exit 1
fi
exec ./entrypoint.sh "$@"
READBOX_SCRIPT
chmod 0755 ./readbox-start.sh
READBOX_CREATE_WRAPPER

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DOCKER_RUNTIME=true

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health/live').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["./readbox-start.sh"]
CMD ["node", "server.js"]
