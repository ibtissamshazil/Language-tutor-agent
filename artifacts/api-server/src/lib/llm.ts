import OpenAI from "openai";
import { openai as replitOpenAI } from "@workspace/integrations-openai-ai-server";

// LLM provider resolution.
//
// Preferred: OpenRouter, called DIRECTLY with the user's own API key
// (`OPENROUTER_API_KEY`). OpenRouter offers free models, so this lets the tutor
// run without a paid Replit plan. Get a free key at https://openrouter.ai/keys.
//
// Fallback: the Replit AI Integrations OpenAI proxy (billed to Replit credits),
// used only when no OpenRouter key is configured.

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// A capable free OpenRouter model. Override with OPENROUTER_MODEL if desired.
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3-0324:free";

// The Replit OpenAI integration model used in fallback mode.
const OPENAI_MODEL = "gpt-5.4";

export const usingOpenRouter = Boolean(OPENROUTER_API_KEY);

export const llm: OpenAI = usingOpenRouter
  ? new OpenAI({
      apiKey: OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    })
  : replitOpenAI;

export const LLM_MODEL = usingOpenRouter ? OPENROUTER_MODEL : OPENAI_MODEL;
