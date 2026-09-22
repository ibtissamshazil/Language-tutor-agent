---
name: OpenRouter free LLM
description: How the tutor runs its LLM for free via OpenRouter, and the pitfalls of free model slugs.
---

# OpenRouter free LLM

The tutor's chat can run with no paid Replit plan by calling OpenRouter **directly**
with the user's own `OPENROUTER_API_KEY` (free key from https://openrouter.ai/keys).
Provider selection lives in `artifacts/api-server/src/lib/llm.ts`: if
`OPENROUTER_API_KEY` is set it builds an OpenAI SDK client pointed at
`https://openrouter.ai/api/v1`; otherwise it falls back to the Replit AI
Integrations OpenAI proxy (billed, paid plan only).

**Why direct, not the Replit OpenRouter integration:** the Replit
`ai-integrations-openrouter` proxy still routes through Replit billing and needs a
paid plan. Direct + own key is the only genuinely free path.

**Param difference:** OpenRouter free models use `max_tokens`; the Replit `gpt-5.4`
fallback needs `max_completion_tokens`. The chat route branches on `usingOpenRouter`.

## Free model slugs are volatile — do not hardcode blindly
- `:free` slugs are added/removed over time and a slug can flip from free to paid
  (seen: `deepseek/deepseek-chat-v3-0324:free` → 404 "unavailable for free, use the
  paid slug").
- Free models are rate-limited **per upstream provider** (HTTP 429,
  "temporarily rate-limited upstream", e.g. provider Venice for llama-3.3-70b:free).
  A 429 surfaces to the user as "Failed to generate a reply".

**Do not pin a single slug.** Any single free model WILL break; pinning one turns
routine churn into a total outage of every language at once. The server therefore
resolves an ordered candidate chain and retries the next model when the request
fails before any token is streamed.

**Why:** both previously pinned slugs went "unavailable for free" simultaneously,
which took the whole app down even though ~24 other free models were live.

## Traps when picking replacement free models
- **Reasoning models return `content: null`** — the whole answer lands in a
  `reasoning` field, so the chat renders blank. Others leak visible
  chain-of-thought ("Okay, the user is asking...") into the reply.
- **`openrouter/free` (the auto-router) is unsafe as a default** — it can route a
  request to a content-safety classifier or a code-only model, which answers with
  something like "User Safety: safe" instead of a lesson.
- **Some free models are 10-100x slower** (one took 136s for a short reply). Time
  the probe, don't just check for HTTP 200.

**How to apply:** when chat fails, read the api-server log for the OpenRouter error,
then probe `GET https://openrouter.ai/api/v1/models` and filter for
`pricing.prompt == 0 && pricing.completion == 0`. Test each candidate with a REAL
`chat/completions` call using the app's own system prompt, and accept only models
that return non-null, clean prose, in reasonable time, with the taught-term markup
intact. A 429 on the first attempt often clears on retry, so probe twice before
discarding a model. `OPENROUTER_MODEL` still overrides everything as an escape hatch.

## Instruction-following differs sharply across the free chain (probed 2026-09-22)
Availability is not the only axis — the chain members are not interchangeable in
quality. Probed with the app's real system prompt (a demanding one: strict
taught-term markup plus a long dialect brief), only `inclusionai/ling-3.0-flash-vl:free`
returned a complete, well-formed lesson. The other three chain members returned an
EMPTY completion for the same request in a single-model run.

**Why this matters:** the fallback chain advances on *availability* failures
(a create() that throws), never on a bad or empty answer. So a weaker model that
answers with nothing still "succeeds" and the learner sees a blank reply.

**How to apply:** when ordering the chain, put the best instruction-follower first,
and when chat returns something empty or off-format, check the "Generating with
model" log line before suspecting the prompt — it names the model that actually
served that reply.
