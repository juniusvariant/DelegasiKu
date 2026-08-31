# Development Progress

## WP-00: Monorepo Scaffold ✅ COMPLETE

### Completed (2026-08-31)
- ✅ Created Turborepo + pnpm workspace configuration
- ✅ Set up TypeScript base config with strict mode
- ✅ Configured ESLint + Prettier with recommended rules
- ✅ Added Node 24 version pinning (.nvmrc)
- ✅ Created workspace structure:
  - `apps/web` - SvelteKit frontend
  - `apps/api` - Fastify domain core
  - `apps/callback` - Fastify webhook intake
  - `apps/worker` - BullMQ worker
  - `packages/shared` - Shared types and utilities
- ✅ Added basic package.json for each workspace
- ✅ Created Prisma schema scaffold
- ✅ Set up .env.example with all required configuration
- ✅ VSCode workspace settings and recommended extensions
- ✅ README with quick start instructions
- ✅ **Dependencies installed successfully (pnpm 9.15.9)**
- ✅ **All workspaces build successfully** (Turbo: 5/5 tasks, 4.8s)

### Build Verification
```
✓ @dku/shared built (TypeScript compilation)
✓ @dku/api built (Fastify service)
✓ @dku/callback built (Fastify webhook)
✓ @dku/worker built (BullMQ worker)
✓ @dku/web built (SvelteKit SSR + client bundles)
```

### pnpm Version Note
- Initially attempted pnpm 11.24.0 (encountered build script approval issues)
- Rolled back to **pnpm 9.15.9** for smoother development experience
- Can upgrade to pnpm 11 later with manual `pnpm approve-builds`

## WP-01: Data Layer - In Progress (Partially Blocked)

### Completed
- ✅ Prisma schema (all 6 tables, no raw NIK)
- ✅ Seed script written
- ✅ Database scripts configured

### Blocked
- ⚠️ Prisma Client generation (requires PostgreSQL or workaround)
- ⚠️ Migration creation (requires database)
- ⚠️ Seed execution (requires database + client)

**See [`BLOCKERS.md`](BLOCKERS.md) for resolution plan.**

## WP-02: Token Utilities ✅ COMPLETE

### Completed
- ✅ Token generation (T1, T2) with 192-bit entropy
- ✅ SHA-256 digest functions
- ✅ Constant-time comparison
- ✅ NIK HMAC reference (T4)
- ✅ KYC request signature (T3)
- ✅ 15/15 tests passed
- ✅ Build verified across all workspaces

## WP-03: Verification Adapter Interface ✅ COMPLETE

### Completed
- ✅ Adapter port interface defined
- ✅ DEMO adapter with deterministic fixtures
- ✅ Success/Rejection/Unavailable/Review outcomes
- ✅ Persistent simulationMode=true labeling (FR-17)
- ✅ 24/24 tests passed (tokens + adapter)
- ✅ Build verified across all workspaces

## WP-01: Data Layer ✅ COMPLETE (RESOLVED)

### Completed
- ✅ Prisma Client generated (fix: prisma/package.json with pinned deps)
- ✅ PostgreSQL 18 + Valkey 9.1 via docker-compose.dev.yml
- ✅ Migration `20260831065431_init` applied cleanly
- ✅ Seed idempotent (ran 2x), zero NIK columns
- ✅ Fixed PG18 volume path + stale OrbStack port conflict

## WP-04: API Domain Core ✅ COMPLETE

### Completed
- ✅ Delegation state machine + activation rule (pure functions, 24 tests)
- ✅ DelegationRepository (Prisma data access)
- ✅ DelegationService (full lifecycle: create/invite/consent/verify/accept/revoke/proof)
- ✅ 12 routes wired (delegations, invitations, proofs, session, system)
- ✅ zod config validation, Prisma plugin, error handler, adapter factory
- ✅ Pino redaction for tokens/NIK/secrets (§12.1)
- ✅ **End-to-end verified with real HTTP calls against running server:**
  - create → invite → consent → verify (DEMO) → complete → accept → ACTIVE → audit timeline → revoke → REVOKED
  - Unknown proof token → NOT_VALID (fail-closed, AC-13)
  - 7 audit events recorded correctly (FR-14)

## Work Package Status

- [x] WP-00 — Monorepo scaffold ✅
- [x] WP-01 — Data layer ✅ (PG18 + migration + seed)
- [x] WP-02 — Shared contracts + token utilities ✅
- [x] WP-03 — Verification adapter interface ✅
- [x] WP-04 — API domain core ✅ (E2E verified)
- [x] WP-05 — Callback + worker ✅ (E2E verified: idempotency + async pipeline)
- [x] WP-06 — Frontend (SvelteKit) ✅ (E2E verified: landing/proof/admin/invitation)
- [x] WP-07 — Live e.id integration ✅ (LIVE_VERIFIER verified against production gateway)
- [ ] WP-08 — OpenAPI docs
- [ ] WP-09 — Deployment configs (compose ✅, Dockerfiles pending)
- [ ] WP-10 — Tests + security
- [ ] WP-11 — Demo rehearsal

## Key Files Created

### Root Configuration
- `package.json` - Root workspace with Turbo scripts
- `pnpm-workspace.yaml` - Workspace definition
- `turbo.json` - Turborepo task configuration
- `tsconfig.json` - Base TypeScript config
- `.nvmrc` - Node version (24)
- `eslint.config.mjs` - ESLint flat config
- `.prettierrc.json` - Prettier config
- `.env.example` - Environment template

### Shared Package
- `packages/shared/src/types/status.ts` - Status enums (DelegationStatus, VerificationStatus, ProofStatus)
- `packages/shared/src/types/verification.ts` - NormalizedVerificationResult contract
- `packages/shared/src/constants/integration.ts` - IntegrationMode enum
- `packages/shared/src/errors/index.ts` - Domain error classes

### Services (Scaffolds)
- `apps/api/src/server.ts` + `app.ts` - API entry point
- `apps/callback/src/server.ts` - Callback entry point
- `apps/worker/src/index.ts` - Worker entry point
- `apps/web/src/routes/+page.svelte` - Web landing page

### Database
- `prisma/schema.prisma` - Schema scaffold (placeholder Organization model)

## Notes
- Using Node 26 (higher than required 24, but compatible)
- pnpm 9.15.0 installed globally
- All TypeScript configs use strict mode and ESM
- Services follow ADR-002 stack decisions
