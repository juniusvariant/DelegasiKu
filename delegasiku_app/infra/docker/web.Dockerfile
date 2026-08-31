# DelegasiKu — web frontend (multi-stage, non-root, WP-09)
# Build context: repo root (delegasiku_app/)

# ---------- Stage 1: base + workspace deps ----------
FROM node:24-alpine AS deps
RUN corepack enable
WORKDIR /app

ARG API_BASE_URL=http://localhost:3001

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --filter @dku/web...

# ---------- Stage 2: build (SvelteKit + adapter-node) ----------
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app

ARG API_BASE_URL
ENV API_BASE_URL=$API_BASE_URL

COPY --from=deps /app ./
COPY tsconfig.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

RUN pnpm --filter @dku/shared build \
 && pnpm --filter @dku/web build

# ---------- Stage 3: runtime ----------
FROM node:24-alpine AS runtime
RUN corepack enable && apk add --no-cache wget
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

RUN addgroup -S delegasiku && adduser -S delegasiku -G delegasiku

COPY --from=build --chown=delegasiku:delegasiku /app/apps/web/build ./apps/web/build
COPY --from=build --chown=delegasiku:delegasiku /app/apps/web/package.json ./apps/web/
COPY --from=build --chown=delegasiku:delegasiku /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=build --chown=delegasiku:delegasiku /app/node_modules ./node_modules
COPY --from=build --chown=delegasiku:delegasiku /app/package.json ./

USER delegasiku

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

WORKDIR /app/apps/web
CMD ["node", "build/index.js"]
