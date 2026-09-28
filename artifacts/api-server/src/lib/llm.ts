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
// Order matters twice over: the chain only advances when a model FAILS to open
// a stream, never when it answers badly, so the best instruction-follower has
// to come first. Verified by probing each slug with the real teaching prompt
// (2026-09-28) — the two previous leaders now 404, and several free models
// either leak their chain-of-thought into the reply or return empty content.
const OPENROUTER_FALLBACK_MODELS = [
  // Clean prose, keeps the [[term]] / {{sentence}} markup, holds the dialect.
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  // Usable, but leaks visible reasoning ("We need to teach...") on some turns.
  "nvidia/nemotron-3-super-120b-a12b:free",
  // Solid when its provider is not rate-limiting (429s are common).
  "google/gemma-4-31b-it:free",
  "qwen/qwen3.8-27b:free",
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
export function resolveModels(
  language: LanguageDef,
  requested?: string | null,
): string[] {
  if (!usingOpenRouter) return [OPENAI_MODEL];
  if (OPENROUTER_MODEL_OVERRIDE) return [OPENROUTER_MODEL_OVERRIDE];
  const preferred = language.model?.openRouter;
  // A model the student picked in Settings leads, but never alone: free slugs
  // die without notice, and a dead choice must degrade to a working tutor
  // rather than to an error. "auto" means "no opinion, use the usual order".
  const chosen = requested && requested !== AUTO_MODEL ? [requested] : [];
  const chain = [
    ...chosen,
    ...(preferred ? [preferred] : []),
    ...OPENROUTER_FALLBACK_MODELS,
  ];
  return Array.from(new Set(chain));
}

/** Sentinel the client sends when the student has not picked a model. */
export const AUTO_MODEL = "auto";

/** The order tried when no model is picked, for display in Settings. */
export function autoModelOrder(): string[] {
  if (!usingOpenRouter) return [OPENAI_MODEL];
  if (OPENROUTER_MODEL_OVERRIDE) return [OPENROUTER_MODEL_OVERRIDE];
  return [...OPENROUTER_FALLBACK_MODELS];
}

/** True when picking a model cannot change anything. */
export const modelChoiceLocked =
  !usingOpenRouter || Boolean(OPENROUTER_MODEL_OVERRIDE);

/** Slugs verified to teach in the tutor's format, with any caveat to show. */
export const MODEL_NOTES: Record<string, string> = {
  "nvidia/nemotron-3-ultra-550b-a55b:free": "",
  "nvidia/nemotron-3-super-120b-a12b:free": "Sometimes shows its own notes",
  "google/gemma-4-31b-it:free": "Often busy",
  "qwen/qwen3.8-27b:free": "Often busy",
};
