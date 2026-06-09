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

// Shared free OpenRouter default, used when neither a per-language model nor the
// OPENROUTER_MODEL override is set. :free slugs come and go / get rate-limited,
// so this is intentionally overridable.
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-oss-120b:free";

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
 * Resolve the model slug to use for a given language.
 *
 * OpenRouter: a global OPENROUTER_MODEL override wins; otherwise the language's
 * own model from the registry (a stronger model for harder scripts); otherwise
 * the shared default. The Replit fallback always uses its single capable model.
 */
export function resolveModel(language: LanguageDef): string {
  if (!usingOpenRouter) return OPENAI_MODEL;
  return (
    OPENROUTER_MODEL_OVERRIDE ??
    language.model?.openRouter ??
    DEFAULT_OPENROUTER_MODEL
  );
}
