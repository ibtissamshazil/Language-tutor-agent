---
name: Private account migration
description: Legacy data ownership and non-destructive account migration constraints
---
Historical shared chats and completions must remain unclaimed and inaccessible.
Never assign them to the first signup or infer a historical owner.

**Why:** The user explicitly required preservation without automatic inheritance.

**How to apply:** Any future administrative assignment requires explicit owner
approval and a reviewed record list. Avoid schema push for this transition:
nullable legacy ownership and insert-time ownership enforcement are intentional.

