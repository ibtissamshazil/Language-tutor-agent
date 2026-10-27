---
name: Codegen with catalog dependencies
description: Why Orval needs explicit React Query major-version configuration in this workspace.
---

Keep Orval's React Query target major explicit when dependencies use pnpm catalogs.

**Why:** During a security upgrade, Orval could not resolve the installed React Query version from a `catalog:` dependency and silently targeted v4 despite the app using v5. Generation succeeded but produced incompatible query option types.

**How to apply:** When updating Orval or React Query, keep their major-version settings aligned and regenerate the client before typechecking consumers. Do not assume successful generation proves the installed runtime was detected.
