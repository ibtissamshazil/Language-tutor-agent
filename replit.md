# Urdu Tutor

An AI-powered language tutor web app: a chat interface where an LLM teaches Urdu to English speakers, mixing both languages so learners pick up the right words in context. Includes browsable beginner lessons (greetings, numbers, common phrases) with Urdu script, transliteration, and English meaning.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/tutor run dev` — run the web frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- LLM (free, preferred): `OPENROUTER_API_KEY` — your own free key from https://openrouter.ai/keys. Optional `OPENROUTER_MODEL` to override the default free model.
- LLM (fallback, paid): `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — used only when `OPENROUTER_API_KEY` is not set (requires a paid Replit plan).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Frontend: React + Vite, wouter (routing), TanStack Query, Tailtwind + tw-animate-css
- DB: PostgreSQL + Drizzle ORM
- LLM: OpenRouter (free models) called directly with the user's own `OPENROUTER_API_KEY`; falls back to OpenAI via Replit AI Integrations proxy if no OpenRouter key is set
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)

## Where things live

- API contract source of truth: `lib/api-spec/openapi.yaml` — run codegen after editing
- Generated React Query hooks: `@workspace/api-client-react` (import from here, never relative paths)
- Generated Zod schemas: `@workspace/api-zod`
- DB schema: `lib/db/src/schema/` (`conversations.ts`, `messages.ts`)
- OpenAI server SDK wrapper: `@workspace/integrations-openai-ai-server` (exports `openai` client)
- Backend routes: `artifacts/api-server/src/routes/` — `openai.ts` (chat), `lessons.ts` (static lesson content)
- Frontend: `artifacts/tutor/src/` — `pages/` (chat, lessons, lesson-detail), `components/`
- SSE stream parser (frontend): `artifacts/tutor/src/lib/sse.ts`

## Architecture decisions

- Chat replies stream via Server-Sent Events from `POST /api/openai/conversations/{id}/messages`. Orval cannot type SSE, so this endpoint has NO generated hook — the frontend POSTs with `fetch` and parses the stream manually. All other endpoints use generated hooks.
- Conversations and messages are persisted in Postgres; full message history is replayed to the LLM as context on each turn (with the tutor system prompt prepended).
- Lessons are static content served from `lessons.ts` (no DB table) — simple seed data, no admin/CRUD.
- The tutor system prompt ("Ustaad") enforces the teaching style: mix English + Urdu, always give Urdu script + transliteration + English meaning together.
- Urdu script renders with the `Noto Nastaliq Urdu` font (Google Fonts) and `dir="rtl"`. The chat message component auto-detects Arabic/Urdu unicode ranges and styles those spans larger.

## Product

- Chat tutor at `/` (and `/chat/:id`): start/continue/delete conversations, streaming bilingual replies. A top progress bar shows progress toward today's learning goal; the tutor proactively tells the student what to learn next and, once the daily goal is reached, congratulates them and offers to continue or rest till tomorrow.
- Lessons browser at `/lessons` and `/lessons/:slug`: beginner topics with phrases, plus a "Practice in Chat" jump-off.

## Daily progress

- Progress is derived (not stored) from Urdu taught in today's `assistant` messages. Scoring lives in `artifacts/api-server/src/lib/progress.ts` (points = Urdu word count per phrase; tune `DAILY_TARGET` there). `GET /api/progress/today` returns the daily summary; the chat handler injects a per-turn progress directive into the LLM so it reacts to how close the student is to the goal.
- The progress scorer uses the SAME Urdu unicode regex as the frontend renderer (`chat-message.tsx`) — keep them in sync.

## User preferences

- No emojis in the UI.

## Gotchas

- `tw-animate-css` `animate-in` does NOT apply `fill-mode: forwards` by default. Do NOT pair `animate-in fade-in` with a static `opacity-0` class — the element reverts to (or starts) invisible. Use `animate-in fade-in` alone, or set `animationFillMode: "both"` inline.
- Restart the `artifacts/api-server` workflow after adding/mounting new routes — the dev workflow builds once on start.
- LLM provider/model is resolved in `artifacts/api-server/src/lib/llm.ts`. OpenRouter free models use `max_tokens`; the Replit `gpt-5.4` fallback needs `max_completion_tokens` — the chat route branches on `usingOpenRouter`.
- OpenRouter free model slugs (the `:free` ones) come and go and get rate-limited (HTTP 429) per upstream provider. If chat returns "Failed to generate a reply", check the api-server log for the OpenRouter error, then probe `GET https://openrouter.ai/api/v1/models` (filter pricing prompt+completion == 0) and set `OPENROUTER_MODEL` to a working one. Default is `openai/gpt-oss-120b:free`.
- Do not change the OpenAPI `info.title` — it controls generated filenames.
- Never use `console.log` in server code — use `req.log` in handlers, `logger` elsewhere.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `ai-integrations-openai` skill for the OpenAI integration setup
