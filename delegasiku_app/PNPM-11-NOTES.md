# pnpm 11 Migration Notes

## New Security Features in pnpm 11

pnpm 11 introduced several security features that require configuration for development:

### 1. Supply-Chain Policy Check
**Issue:** Blocks packages published < 24 hours ago
**Error:** `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`
**Solution:** Added `minimum-release-age=0` to `.npmrc`

### 2. Build Script Approval
**Issue:** Blocks all postinstall/build scripts by default (Prisma, esbuild, msgpackr-extract)
**Error:** `ERR_PNPM_IGNORED_BUILDS`
**Solution:** Added `enable-pre-post-scripts=true` to `.npmrc`

### 3. Module Removal Confirmation
**Issue:** Requires TTY confirmation to remove node_modules
**Error:** `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`
**Solution:** Use `pnpm install --force` or set CI=true

## .npmrc Configuration

```
auto-install-peers=true
strict-peer-dependencies=false
shamefully-hoist=false
minimum-release-age=0
enable-pre-post-scripts=true
```

## For Production

In production/CI environments, consider:
- Keeping `minimum-release-age=86400` (24 hours) for security
- Using explicit build script approval via `pnpm approve-builds`
- Setting `CI=true` environment variable

## References

- pnpm 11 release notes: https://github.com/pnpm/pnpm/releases/tag/v11.0.0
- Supply chain security: https://pnpm.io/cli/audit
- Build scripts: https://pnpm.io/cli/install#enable-pre-post-scripts
