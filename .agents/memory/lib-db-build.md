---
name: lib-db must export compiled JS for Docker
description: Workspace package lib/db must be pre-built to dist/ with esbuild; exporting .ts source files causes ERR_MODULE_NOT_FOUND in Railway/Docker deployments.
---

## Rule
`lib/db/package.json` exports must point to `./dist/*.js`, never to `./src/*.ts`.

**Why:** pnpm's workspace symlink for `link:` packages in Docker (Railway) points to the actual lib/db directory. tsx's `oxc-resolver` cannot stat `.ts` files through pnpm's workspace symlink resolution chain — it fails with `ERR_MODULE_NOT_FOUND` at `finalizeResolution` even when the source files physically exist. Patches (cp -r, absolute symlinks, .dockerignore fixes) all failed because the root cause is tsx trying to load `.ts` through a symlink, not file absence.

**How to apply:**
- `lib/db` has a `build` script: `esbuild src/index.ts ... && esbuild src/schema/index.ts ...`
- The Dockerfile installs deps (without NODE_ENV=production so devDeps/esbuild are available), runs `pnpm --filter "@workspace/db" run build`, then sets NODE_ENV=production.
- Never revert exports back to `./src/*.ts`.
- If new entrypoints are added to lib/db/src, add a corresponding esbuild call to the build script and a new exports entry pointing to dist/.
