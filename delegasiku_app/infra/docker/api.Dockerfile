# DelegasiKu — api service (multi-stage, non-root, WP-09)
# Build context: repo root (delegasiku_app/)

# ---------- Stage 1: base + workspace deps ----------
FROM node:24-alpine AS deps
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY prisma/package.json ./prisma/

RUN pnpm install --frozen-lockfile --filter @dku/api...

# prisma/ has its own package.json (WP-01 fix): Prisma's ensure-installed
# check spawns `pnpm add prisma @prisma/client` from the schema dir, which
# requires those packages to already be present there.
RUN cd prisma && pnpm add -D prisma@6.1.0 && pnpm add @prisma/client@6.1.0

# ---------- Stage 2: build ----------
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app

COPY --from=deps /app ./
COPY tsconfig.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/
COPY prisma/ ./prisma/

# Generate Prisma Client (with linux-musl target) BEFORE TS compile —
# tsc resolves types from the generated client (WP-01 lesson)
RUN cd apps/api && pnpm exec prisma generate --schema=../../prisma/schema.prisma

RUN pnpm --filter @dku/shared build \
 && pnpm --filter @dku/api build

# ---------- Stage 3: runtime ----------
FROM node:24-alpine AS runtime
RUN corepack enable && apk add --no-cache wget openssl
WORKDIR /app

ENV NODE_ENV=production

# Non-root user (AC-15 / WP-09)
RUN addgroup -S delegasiku && adduser -S delegasiku -G delegasiku

COPY --from=build --chown=delegasiku:delegasiku /app/node_modules ./node_modules
COPY --from=build --chown=delegasiku:delegasiku /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=delegasiku:delegasiku /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=delegasiku:delegasiku /app/apps/api/package.json ./apps/api/
COPY --from=build --chown=delegasiku:delegasiku /app/packages/shared ./packages/shared
COPY --from=build --chown=delegasiku:delegasiku /app/prisma ./prisma
COPY --from=build --chown=delegasiku:delegasiku /app/package.json ./

USER delegasiku

EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/healthz || exit 1

WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]
