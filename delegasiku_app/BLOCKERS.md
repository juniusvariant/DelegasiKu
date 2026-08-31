# DelegasiKu Blockers & Pending Issues

**Purpose:** Track unresolved issues that must be completed before production deployment.

## 🚨 CRITICAL - Must Resolve Before Deployment

### None Currently ✅

---

## 📋 NON-BLOCKING - Can Continue Development

### None Currently

---

## ✅ RESOLVED

### 1. Prisma Client Generation (WP-01) — RESOLVED 2026-08-31

**Issue:** Prisma CLI's `generate` command failed in pnpm workspace with:
```
Error: Command failed with exit code 1: pnpm add prisma@6.1.0 -D --silent
```

**Root Cause:**
Prisma's "ensure packages installed" check spawns `pnpm add <pkg>` from the **schema directory** (`prisma/`), which had no `package.json`. The command failed silently because there was no manifest to add the dependency to.

**Resolution:**
1. Created [`prisma/package.json`](prisma/package.json) with `prisma@6.1.0` + `@prisma/client@6.1.0` so Prisma's auto-install check succeeds.
2. Started PostgreSQL 18 + Valkey 9.1 via [`infra/compose/docker-compose.dev.yml`](infra/compose/docker-compose.dev.yml).
3. Ran migration + seed successfully.

**Additional findings fixed along the way:**
- **PostgreSQL 18 volume path change**: PG18 images store data under `/var/lib/postgresql/<major>/` — mount must be `/var/lib/postgresql`, NOT `/var/lib/postgresql/data` (fixed in both compose files).
- **Stale OrbStack port forwarding**: a leftover ad-hoc container held port 5432; removed and recreated compose stack with `--force-recreate`.

**Verification (AC-01):**
- ✅ Migrations apply cleanly on PostgreSQL 18 (`20260831065431_init`)
- ✅ Seed is idempotent (ran twice, no errors)
- ✅ No NIK column exists (`information_schema` query returned 0 rows)
- ✅ Demo org "PT Maju Jakarta" seeded with `demo_status=demo`

---

## Notes

- This file should be updated whenever a blocker is discovered or resolved
- Critical blockers prevent deployment but may not block all development
- Always mark acceptance criteria status with ✅ (done), ⚠️ (blocked), or ❌ (failed)
