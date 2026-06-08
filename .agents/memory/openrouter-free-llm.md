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

**How to apply:** when chat fails, read the api-server log for the OpenRouter error,
then probe `GET https://openrouter.ai/api/v1/models` and filter for
`pricing.prompt == 0 && pricing.completion == 0` to find currently-free models. Test
a candidate directly with a `chat/completions` curl before committing. Set
`OPENROUTER_MODEL` to override the default. As of the switch,
`openai/gpt-oss-120b:free` and `google/gemma-4-31b-it:free` responded reliably and
produced clean Urdu; `meta-llama/llama-3.3-70b-instruct:free` was frequently 429.
