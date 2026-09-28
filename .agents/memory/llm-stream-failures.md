---
name: LLM stream failures and fallback
description: Where OpenRouter failures actually surface in a streaming call, and what must happen before a model is considered "working".
---

# Streaming failures and the fallback chain

A model has NOT accepted the request just because `chat.completions.create()`
resolved. OpenRouter routes to the upstream provider lazily, so rate limits,
dead providers and gated models surface while reading the response body —
often not on the first chunk, because that is usually an empty role delta.

**Rule:** the candidate loop must read ahead to the first chunk carrying real
`delta.content` INSIDE its try block, buffering the skipped chunks and
replaying them afterwards. Anything that fails before a token has been written
to the client is a failure to start and must fall through to the next model.

A stream that ends without any content counts as a failed attempt too, not as
an answer — otherwise the first model in the chain can silently produce blank
replies forever.

**Why:** retrying only on a rejected `create()` leaves the common case
uncovered — a dead candidate then produces a user-visible error while working
backups are never tried.

**How to apply:** any change to the streaming send path, and any new provider
added alongside OpenRouter.

## Reporting the failure

Free-model failures are frequent and varied, so they are classified (status +
the provider's own `error.metadata.raw` text) rather than reported as one
generic message. Two distinctions are easy to get wrong:

- A 429 can mean "wait a minute" or "the free allowance for the day is gone".
  Only the provider's wording separates them; bare "quota" is NOT a reliable
  marker, because billing errors say it too.
- `insufficient_quota` (OpenAI-style symbolic code) is a billing problem, not
  the daily free allowance. Check symbolic codes before prose.

Account-level failures (bad key, no credits, daily allowance) must outrank the
chosen model's own failure when summarising a whole failed chain — telling the
student to pick another model sends them to fix the wrong thing.
