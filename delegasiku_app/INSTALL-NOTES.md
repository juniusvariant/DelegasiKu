# Installation Notes

## pnpm Version

**Current:** pnpm@11.24.0 ✅ (upgraded from 9.15.0)

ADR-002 specifies `pnpm>=9.0.0`. Upgraded to pnpm 11.24.0 for:
- Better performance and caching
- Improved workspace support
- Latest bug fixes and features

**Upgrade performed:** 2026-08-31 11:51 WIB

## Network Issues

First install attempt encountered npm registry timeouts:
- `commondir` - ETIMEDOUT then ECONNRESET
- `concat-map` - ETIMEDOUT

These are transient network issues. pnpm will retry automatically.

## Node Version

Using Node.js v26.5.0 (exceeds minimum requirement of v24.0.0)
- This is compatible and safe
- Node 24 LTS is the minimum per ADR-002
- Node 26 is current stable

## Install Command

Standard install:
```bash
cd delegasiku_app
pnpm install
```

If network issues persist:
```bash
pnpm install --registry=https://registry.npmjs.org --network-timeout 60000
```
