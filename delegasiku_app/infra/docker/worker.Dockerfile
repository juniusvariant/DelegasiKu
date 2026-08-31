# DelegasiKu — worker service (multi-stage, non-root, WP-09)
# Build context: repo root (delegasiku_app/)

# ---------- Stage 1: base + workspace deps ----------
FROM node:24-alpine AS deps
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --frozen-lockfile --filter @dku/worker...

# ---------- Stage 2: build ----------
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app

COPY --from=deps /app ./
COPY tsconfig.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/worker/ ./apps/worker/

RUN pnpm --filter @dku/shared build \
 && pnpm --filter @dku/worker build

# ---------- Stage 3: runtime ----------
FROM node:24-alpine AS runtime
RUN corepack enable
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S delegasiku && adduser -S delegasiku -G delegasiku

COPY --from=build --chown=delegasiku:delegasiku /app/node_modules ./node_modules
COPY --from=build --chown=delegasiku:delegasiku /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build --chown=delegasiku:delegasiku /app/apps/worker/dist ./apps/worker/dist
COPY --from=build --chown=delegasiku:delegasiku /app/apps/worker/package.json ./apps/worker/
COPY --from=build --chown=delegasiku:delegasiku /app/packages/shared ./packages/shared
COPY --from=build --chown=delegasiku:delegasiku /app/package.json ./

USER delegasiku

WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]
