# Deployment Configuration (WP-09)

Multi-stage Dockerfiles + docker-compose for containerized Demo Day operation.

## Image Targets (built context: `delegasiku_app/`)

```bash
docker build -f infra/docker/api.Dockerfile -t delegasiku/api:test .
docker build -f infra/docker/callback.Dockerfile -t delegasiku/callback:test .
docker build -f infra/docker/worker.Dockerfile -t delegasiku/worker:test .
docker build -f infra/docker/web.Dockerfile -t delegasiku/web:test .
```

## Design principles

- **Non-root users** (AC-15): All containers run as `delegasiku` user (`GID/UID 1000`).
- **Slim alpine base**: node:24-alpine with only runtime deps (`wget`, openssl where needed).
- **No secrets baked**: `.env` excluded via `.dockerignore`. Secrets injected at runtime.
- **Health checks**: All services expose `/healthz`. Compose uses them for orchestration.
- **Prisma client generation**: For API, Prisma binaries are generated for linux-musl targets (see [WP-01 notes](../../PNPM-11-NOTES.md)).

## Running with docker-compose

The compose file is in [`./infra/compose/docker-compose.yml`](../infra/compose/docker-compose.yml). It expects environment variables from a `.env` file:

```bash
# Required local dev variables
cp .env.example .env  # then set your values (EID_VERIFIER_*, VALKEY_URL, etc.)

docker compose --profile deploy up --build --detach
```

### Profile-specific configs

| Profile | Services included | Purpose |
|---|---|---|
| default | api, callback, worker, web, valkey | Local demo day run |
| database-only | postgres | Standalone database backup/export |

## Environment variables (runtime injection)

These should **NOT** be committed (checked by `.gitignore`), but they're required for production:

```bash
INTEGRATION_MODE=LIVE_VERIFIER  # DEMO | LIVE_VERIFIER | LIVE_KYC
EID_VERIFIER_BASE_URL=https://gateway.e.id
EID_VERIFIER_CLIENT_ID=...
EID_VERIFIER_CLIENT_SECRET=...  # secret!
EID_VERIFIER_SCHEMA_ID=...

VALKEY_URL=valkey://valkey:6379  # internal compose name
API_BASE_URL=http://api:3001

PUBLIC_API_BASE_URL=http://localhost:3001  # public URL for web frontend
PUBLIC_WEB_URL=http://localhost:3000
```

## Service descriptions

### api (port 3001)
Fastify REST API — delegation lifecycle, invitations, verification, diagnostics. Runs `dist/server.js`.

### callback (port 3002)
Fastify webhook receiver for e.id Verifier/YC events. Validates signature, deduplicates, enqueues jobs to Valkey.

### worker
BullMQ consumer that performs authoritative fetches after webhook notification (`fetchVerificationResult` / `fetchKycDetails`).

### web
SvelteKit (adapter-node) frontend — proof landing, invitation consent/accept flows, admin dashboard.

### migrate (ephemeral)
Runs `node dist/migrate.js` to execute migrations + idempotent seed before other services start. Used in the compose setup.

### postgres
PostgreSQL 18 with persistent volume (`postgres-data`). Migrations applied once on first boot.

## Security notes (AC-15)

- The image has **no** `.env` files, no hardcoded secret values, no SSH keys, no CI tokens.
- The config module reads `process.env.*` at startup — never loads from disk.
- The `.dockerignore` strips all local state before build.

## Troubleshooting

### Port conflicts
If ports conflict, override them:

```bash
DELEGASIKU_API_PORT=3001 DELEGASIKU_WEB_PORT=3000 docker compose up -d
```

### Health check failures
Inspect logs:

```bash
docker compose logs api callback worker web
```

For local debugging without compose, run containers manually:

```bash
docker run -d \
  --name delegasiku-api \
  --network delegasiku-net \
  -p 3001:3001 \
  -e INTEGRATION_MODE=DEMO \
  -e VALKEY_URL=valkey://localhost:6379 \
  delegasiku/api:test

docker run -d \
  --name delegasiku-callback \
  --network delegasiku-net \
  -p 3002:3002 \
  -e VALKEY_URL=valkey://localhost:6379 \
  -e API_BASE_URL=http://host.docker.internal:3001 \
  delegasiku/callback:test

# ... repeat for worker + web
```

### PostgreSQL connection refused
The database is `postgres` inside the compose network. Ensure services use `PGHOST=postgres`:

```yaml
environment:
  - POSTGRES_HOST=postgres
  - PGDATABASE=delegasiku_dev
```

(Defined in the existing compose files — no change needed for this task.)

## Demo Day checklist

- [ ] Confirm `.env` exists with correct credentials (LIVE_VERIFIER mode uses prod gateway)
- [ ] Build all images locally before demo
- [ ] Run `docker compose up --build` and verify all services healthy
- [ ] Open admin at http://localhost:3000/admin and confirm seeded org/cases visible
- [ ] Test QR code generation → live e.id flow (if LIVE_VERIFIER configured)

---

Generated 2026-08-31 by Qoder for WP-09 (Deployment Configuration).