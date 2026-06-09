---
name: Daily learning progress system
description: How the tutor's daily-goal progress is scored, surfaced, and fed back to the LLM
---

# Daily progress / engagement system

Progress toward the day's goal is **derived, not stored** — there is no progress
counter column. It is recomputed from the taught terms in `assistant` messages
whose `createdAt >= start of local day`, scoped to one language (join on
`conversations.language`).

**Scoring rule:** taught vocabulary is recognized purely by the universal markup
`[[native|transliteration|english]]` — NOT by any unicode/script regex (that
approach was removed in the multi-language conversion). `countLearnings` /
`parseTaughtTerms` live in `@workspace/languages` (`lib/languages/src/markup.ts`)
and are shared by BOTH the server scorer and the frontend chip renderer. Each
taught term is worth at least 1 point. `DAILY_TARGET` (in the server
`progress.ts`) is the points needed for the day.

**Why one parser:** if the server and the frontend recognized taught terms
differently, the progress bar would disagree with what renders as chips. Putting
the parser in the shared lib makes drift structurally impossible — never add a
side-specific regex.

**Why derived:** single-user app, no auth; messages are the source of truth, so a
separate counter would just be a cache that can drift. Recompute is cheap.

**LLM feedback loop:** on every turn the chat handler computes today's progress
and injects a *second* system message (a progress directive) after the static
system prompt. When the goal is reached the directive flips the tutor into a
congratulate + recap + "keep going or rest till tomorrow?" mode. The frontend
shows a top progress bar that invalidates its query after each streamed reply.

**How to apply:** changing taught-term detection means editing `markup.ts` only —
both sides update together. If the goal feels too easy/hard, tune `DAILY_TARGET`.
