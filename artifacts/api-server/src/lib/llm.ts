import OpenAI from "openai";

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

// A capable free OpenRouter model. Override with OPENROUTER_MODEL if desired.
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "openai/gpt-oss-120b:free";

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

export const LLM_MODEL = usingOpenRouter ? OPENROUTER_MODEL : OPENAI_MODEL;
