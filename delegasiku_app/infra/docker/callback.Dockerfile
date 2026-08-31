# DelegasiKu — callback service (multi-stage, non-root, WP-09)
# Build context: repo root (delegasiku_app/)

# ---------- Stage 1: base + workspace deps ----------
FROM node:24-alpine AS deps
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/callback/package.json ./apps/callback/

RUN pnpm install --frozen-lockfile --filter @dku/callback...

# ---------- Stage 2: build ----------
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app

COPY --from=deps /app ./
COPY tsconfig.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/callback/ ./apps/callback/

RUN pnpm --filter @dku/shared build \
 && pnpm --filter @dku/callback build

# ---------- Stage 3: runtime ----------
FROM node:24-alpine AS runtime
RUN corepack enable && apk add --no-cache wget
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S delegasiku && adduser -S delegasiku -G delegasiku

COPY --from=build --chown=delegasiku:delegasiku /app/node_modules ./node_modules
COPY --from=build --chown=delegasiku:delegasiku /app/apps/callback/node_modules ./apps/callback/node_modules
COPY --from=build --chown=delegasiku:delegasiku /app/apps/callback/dist ./apps/callback/dist
COPY --from=build --chown=delegasiku:delegasiku /app/apps/callback/package.json ./apps/callback/
COPY --from=build --chown=delegasiku:delegasiku /app/packages/shared ./packages/shared
COPY --from=build --chown=delegasiku:delegasiku /app/package.json ./

USER delegasiku

EXPOSE 3002
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3002/healthz || exit 1

WORKDIR /app/apps/callback
CMD ["node", "dist/server.js"]
