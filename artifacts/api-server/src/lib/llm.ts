import OpenAI from "openai";
import { type LanguageDef } from "@workspace/languages";

// LLM provider resolution.
//
// Preferred: OpenRouter, called DIRECTLY with the user's own API key
// (`OPENROUTER_API_KEY`). OpenRouter offers free models, so this lets the tutor
// run without a paid Replit plan. Get a free key at https://openrouter.ai/keys.
//
// Fallback: the Replit AI Integrations OpenAI proxy (billed to Replit credits),
// used only when no OpenRouter key is configured.
//
// Both clients are constructed directly here (rather than importing the Replit
// integration wrapper) so that the fallback env vars are only required when the
// fallback is actually used — a free user with only an OpenRouter key must not
// be forced to also provision the paid integration.

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Shared free OpenRouter fallback chain, tried in order after the language's own
// model. Free (:free) slugs are volatile — they get retired, flipped to paid, or
// rate-limited (429) per upstream provider at any moment — so a single pinned
// model is guaranteed to break eventually. Every model here was verified to
// return clean, usable prose (no leaked chain-of-thought, no null content).
//
// Do NOT use the `openrouter/free` auto-router here: it can route a request to a
// classifier or code-only model that answers with something unusable.
const OPENROUTER_FALLBACK_MODELS = [
  "inclusionai/ling-3.0-flash-vl:free",
  "z-ai/glm-5.2:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

// Global escape hatch: when set, this overrides EVERY language's model. Useful
// when a particular free slug starts failing across the board.
const OPENROUTER_MODEL_OVERRIDE = process.env.OPENROUTER_MODEL;

// The Replit OpenAI integration model used in fallback mode.
const OPENAI_MODEL = "gpt-5.4";

export const usingOpenRouter = Boolean(OPENROUTER_API_KEY);

function createClient(): OpenAI {
  if (OPENROUTER_API_KEY) {
    return new OpenAI({
      apiKey: OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }

  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error(
      "No LLM provider configured. Set OPENROUTER_API_KEY for the free OpenRouter " +
        "path (https://openrouter.ai/keys), or provision the Replit OpenAI " +
        "integration (AI_INTEGRATIONS_OPENAI_BASE_URL / AI_INTEGRATIONS_OPENAI_API_KEY).",
    );
  }

  return new OpenAI({ apiKey, baseURL });
}

export const llm: OpenAI = createClient();

/**
 * Resolve the ordered list of model slugs to try for a given language.
 *
 * The caller walks this list and moves to the next candidate when a model is
 * unavailable (retired, flipped to paid, or 429 rate-limited upstream) — which
 * for free OpenRouter models is a routine occurrence, not an exceptional one.
 *
 * OpenRouter precedence: a global OPENROUTER_MODEL override wins outright (and
 * is used alone); otherwise the language's own model from the registry (a
 * stronger model for harder scripts) leads, followed by the shared fallback
 * chain. The Replit fallback provider always uses its single capable model.
 */
export function resolveModels(language: LanguageDef): string[] {
  if (!usingOpenRouter) return [OPENAI_MODEL];
  if (OPENROUTER_MODEL_OVERRIDE) return [OPENROUTER_MODEL_OVERRIDE];
  const preferred = language.model?.openRouter;
  const chain = preferred
    ? [preferred, ...OPENROUTER_FALLBACK_MODELS]
    : [...OPENROUTER_FALLBACK_MODELS];
  return Array.from(new Set(chain));
}
