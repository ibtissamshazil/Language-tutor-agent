---
name: Daily learning progress system
description: How the tutor's daily-goal progress is scored, surfaced, and fed back to the LLM
---

# Daily progress / engagement system

Progress toward the day's goal is **derived, not stored** — there is no progress
counter column. It is recomputed from the Urdu actually taught in `assistant`
messages whose `createdAt >= start of local day`.

**Scoring rule:** each Urdu run (a word, or consecutive Urdu words = one phrase)
is worth points equal to its Urdu word count, so complexity and quantity both
count. `DAILY_TARGET` is the points needed for the day. The scoring helpers live
in one place and are shared by both the read endpoint and the chat handler — keep
them in sync (same Urdu regex as the frontend renderer).

**Why derived:** single-user app, no auth; messages are the source of truth, so a
separate counter would just be a cache that can drift. Recompute is cheap.

**LLM feedback loop:** on every turn the chat handler computes today's progress
and injects a *second* system message (a progress directive) after the static
system prompt. When the goal is reached the directive flips the tutor into a
congratulate + recap + "keep going or rest till tomorrow?" mode. The frontend
shows a top progress bar that invalidates its query after each streamed reply.

**How to apply:** if you change the Urdu detection regex, change it in the scorer
too or points will disagree with what renders. If goal feels too easy/hard,
tune `DAILY_TARGET` only — a single rich reply is ~20-25 points.
