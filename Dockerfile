# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1. Install all build/runtime dependencies with layer caching
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

# 2. Isolated minimal Prisma CLI + dotenv dependencies for idempotent runtime migrations
FROM base AS migrator
WORKDIR /migrator
RUN npm install --no-save --no-audit --no-fund prisma@7.10.1 dotenv@18.0.8

# 3. Build Next.js standalone production bundle
FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV AUTH_ENABLED=false
RUN npx prisma generate && npm run build

# 4. Compact, non-root production runtime image
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
    /run/vibmail \
  && chown -R nextjs:nodejs \
    /app \
    /var/vmail \
    /var/lib/readbox \
    /var/lock/readbox-provision \
    /etc/opendkim/keys \
    /run/vibmail

# Copy Prisma CLI dependencies first, then Next.js standalone bundle (standalone runtime wins on shared libs)
COPY --from=migrator --chown=nextjs:nodejs /migrator/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health/live').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
