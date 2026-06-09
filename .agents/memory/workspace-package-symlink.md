---
name: Missing @workspace/* symlink after adding a lib export
description: Why typecheck suddenly can't resolve a workspace package, and the fix
---

After adding a new file/export to a `lib/*` package (e.g. `lib/languages/src/levels.ts`), a leaf artifact typecheck can fail to resolve the `@workspace/<pkg>` import even though the package builds fine.

**Cause:** the `node_modules/@workspace/<pkg>` symlink can be missing/stale in the consuming artifact, so TS resolves nothing.

**Fix:** run `pnpm install` at the repo root to re-create the workspace symlinks, then re-run `pnpm run typecheck`. (`pnpm install` may report "Already up to date" yet still repair the symlink.)

**How to apply:** if a known-good `@workspace/*` import fails resolution right after a lib change, suspect the symlink before suspecting the import path — verify with `ls -la artifacts/<name>/node_modules/@workspace/`.
