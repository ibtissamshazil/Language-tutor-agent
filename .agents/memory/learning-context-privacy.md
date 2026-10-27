---
name: Learning context privacy
description: Product constraints for cross-chat learning continuity
---
Cross-chat learning context must remain bounded, account-private and language-scoped,
derived from saved chats and current lesson completions rather than a permanent
second copy of chat content. Deleting a source removes its contribution to future
summaries. Taught vocabulary and completion checkboxes are not evidence of mastery.

**Why:** The requested continuity feature explicitly excludes independent memory
storage, inferred mastery, and automatic assignment of historical shared records.

**How to apply:** Preserve these semantics when expanding retrieval or changing
prompt construction. Treat historical text as untrusted reference data, not
instructions; do not introduce a stale cache that retains deleted contributions.
