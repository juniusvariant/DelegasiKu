<div align="center">

# DelegasiKu

**Verified, time-bound, revocable delegation of authority — powered by e.id identity**

[![Stack](https://img.shields.io/badge/stack-SvelteKit%20%C2%B7%20Fastify%20%C2%B7%20PostgreSQL%2018%20%C2%B7%20Valkey-284e7d)](docs/openapi.yaml)
[![Integration](https://img.shields.io/badge/e.id-Verifier%20API%20%C2%B7%20live-green)](docs/eid-verifier-integration.md)
[![Deployment](https://img.shields.io/badge/deploy-docker%20compose%20%C2%B7%20K8s%20ready-blue)](infra/docker/README.md)

*Turns "who are you?" into "are you authorized to do exactly this, right now?"*

</div>

---

## What It Does

KYC tells us **who a person is**. DelegasiKu answers the harder operational question:

> **Is this verified person currently authorized to perform this exact action for this specific case?**

A business owner delegates a consultant to submit permit documents. The consultant verifies identity through e.id, accepts the precise scope, and receives a **live proof (QR/link)**. Any officer can scan it and instantly see:

`ACTIVE` · `REVOKED` · `EXPIRED` · `NOT_VALID`

**The same QR flips status in real time.** Revoke it, and the very next scan shows `REVOKED` — the proof is not a static document.

## Live e.id Integration ✅

Connected to the **production e.id Verifier API** (`gateway.e.id`). The full lifecycle is verified:

`auth token → verification schema → VP request (QR) → webhook → authoritative fetch → delegation ACTIVE`

## Architecture

Four services in one Turborepo monorepo — stateless, horizontally scalable:

```
┌────────────┐      ┌──────────────────────────────────────────┐
│  e.id      │─────▶│  callback   webhook intake (fast 2xx)    │
│  Gateway   │      └────┬───────────────┬─────────────────────┘
└────────────┘           │               │
                         ▼               ▼
                   ┌──────────┐   ┌────────────┐
                   │ Valkey   │   │  worker    │ authoritative
                   │ (cache+  │──▶│  (BullMQ)  │ fetch (FR-06)
                   │  queue)  │   └─────┬──────┘
                   └──────────┘         │
                                        ▼
┌────────────┐      ┌─────────────────────────────┐
│  web       │─────▶│  api        domain core      │
│  SvelteKit │      │  Fastify    activation rule  │
│  SSR       │      └────┬────────┴───────────────┘
└────────────┘           │
                         ▼
                   ┌──────────┐
                   │PostgreSQL│
                   │    18    │
                   └──────────┘
```

| Service | Stack | Role |
|---------|-------|------|
| `apps/web` | SvelteKit (Svelte 5) + Tailwind v4 | Admin dashboard, invitation flow, SSR public proof |
| `apps/api` | Fastify 5 (TS) | Delegation lifecycle, activation rule, read-time expiry |
| `apps/callback` | Fastify 5 | e.id webhook intake — validate, dedupe, fast 2xx |
| `apps/worker` | Node 24 + BullMQ | Authoritative fetch, state transitions, expiry sweep |
| `packages/shared` | TypeScript | Token utils, verification adapters, normalized contract |

## Key Design Decisions

- **No raw NIK anywhere** — only SHA-256 digests and keyed-HMAC references (FR-07)
- **Read-time expiry** — status computed at read, never job-dependent (ADR-004)
- **Callbacks are notifications only** — activation requires authoritative server-side fetch (FR-06)
- **Fail-closed** — provider errors never produce an incorrect `ACTIVE` (§12.3)
- **Three integration modes** — `DEMO` (offline) / `LIVE_VERIFIER` / `LIVE_KYC`, config-only switch (ADR-005)

## Quick Start

### Local development

```bash
# 1. Install
pnpm install

# 2. Configure
cp .env.example .env   # add e.id credentials for LIVE mode

# 3. Start infrastructure
docker compose -f infra/compose/docker-compose.dev.yml up -d

# 4. Migrate + seed
pnpm db:migrate && pnpm db:seed

# 5. Run all services
pnpm dev
```

### Full stack (Docker)

```bash
# One command: builds + migrates + seeds + runs all 6 services
docker compose -f infra/compose/docker-compose.yml up --build
```

Then open:
- **Admin dashboard** → http://localhost:3000/admin
- **API** → http://localhost:3001/api/diagnostics

## The 3-Minute Demo

1. **Create** a delegation for case `PMT-JKS-2026-001` → one-time invitation link
2. **Verify** representative identity via e.id (QR scan → APPROVED)
3. **Accept** scope → delegation goes `ACTIVE` → proof QR issued
4. **Scan** the proof → shows `ACTIVE` + minimized details
5. **Revoke** in the dashboard → scan the **same** QR → now shows `REVOKED`

That instant status flip — from one unchanging QR — is the core demonstration.

## Documentation

| Doc | Contents |
|-----|----------|
| [`docs/DEMO-SCRIPT.md`](docs/DEMO-SCRIPT.md) | **3-minute presenter script** (with cheat-sheet + fallbacks) |
| [`docs/openapi.yaml`](docs/openapi.yaml) | OpenAPI 3.1 spec — all 19 endpoints |
| [`docs/eid-verifier-integration.md`](docs/eid-verifier-integration.md) | Live e.id integration notes (real API behavior) |
| [`docs/SECURITY-REVIEW.md`](docs/SECURITY-REVIEW.md) | Security posture + acceptance criteria mapping |
| [`docs/DEMO-DAY-CHECKLIST.md`](docs/DEMO-DAY-CHECKLIST.md) | Demo runbook + edge-case tests |
| [`infra/docker/README.md`](infra/docker/README.md) | Deployment guide |

Architecture decisions live in [`../delegasiku_docs/adr/`](../delegasiku_docs/adr/) (ADR-001 through ADR-005).

## Test

```bash
pnpm test      # 48 tests across workspaces
pnpm build     # 5/5 workspaces compile
```

---

<div align="center">
<small>DelegasiKu — competition entry. Built with e.id.</small>
</div>
