# Language Tutor

An AI-powered language tutor web app: a chat interface where an LLM teaches a target language to English speakers, mixing both languages so learners pick up the right words in context. Supports 10 languages (Spanish, French, German, Italian, Portuguese, Mandarin Chinese, Japanese, Hindi, Arabic, Urdu). Includes browsable beginner lessons (greetings, numbers, common phrases) with native script, transliteration, and English meaning. The app name "Language Tutor" is fixed (it does not track the active language) and is shown in the sidebar/header, the browser tab title, and the social/meta tags.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/tutor run dev` — run the web frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- LLM (free, preferred): `OPENROUTER_API_KEY` — your own free key from https://openrouter.ai/keys. Optional `OPENROUTER_MODEL` to override the per-language default free model.
- LLM (fallback, paid): `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — used only when `OPENROUTER_API_KEY` is not set (requires a paid Replit plan).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Frontend: React + Vite, wouter (routing), TanStack Query, Tailwind + tw-animate-css
- DB: PostgreSQL + Drizzle ORM
- LLM: OpenRouter (free models) called directly with the user's own `OPENROUTER_API_KEY`; falls back to OpenAI via Replit AI Integrations proxy if no OpenRouter key is set
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)

## The language registry — single source of truth

- `@workspace/languages` (`lib/languages/src/`) is the ONE place that defines what the tutor can teach. Both the API server (prompt building, model selection, progress scoring) and the frontend (language picker, script rendering, lessons) import from it so the two sides can never drift apart.
- `registry.ts` exports `LANGUAGES: LanguageDef[]` and helpers. Each `LanguageDef` carries: `code` (stable, persisted on conversations, e.g. `es`/`ur`/`zh`), `name`, `nativeName`, `direction` (`ltr`/`rtl`), `fontClass` (Tailwind font utility for the native script, `""` = default Latin), `usesTransliteration`, `greeting` (chat empty-state), `promptScriptNote` + `markupExample` (injected into the prompt), and an optional per-language `model.openRouter` override.
- `levels.ts` is the matching single source of truth for the learner's **expertise level** (Beginner / Intermediate / Advanced). It exports `LEVELS: LevelDef[]` (`code`, `name`, `description` for the UI, `promptNote` for the tutor prompt) and helpers (`getLevel`, `isLevelCode`, `DEFAULT_LEVEL_CODE`). The level is persisted per-conversation (like language) and drives how much the tutor scaffolds.
- `markup.ts` is the universal taught-term format: `parseTaughtTerms(text)`, `parseSentenceBlocks(text)`, the unified `parseContentSegments(text)` tokenizer, and `countLearnings(text)`. There is NO unicode/script regex anymore — taught vocabulary is recognized purely by the markup below.

## Taught-term markup (the core convention)

- The tutor wraps every taught term as `[[native|transliteration|english]]`. Transliteration is empty for Latin-script languages, e.g. `[[hola||hello]]`; non-Latin example `[[نمستے|namaste|hello]]`. These render as inline vocabulary chips.
- The tutor ALSO writes one full example SENTENCE per teaching reply using a SEPARATE block `{{native|transliteration|english}}` (different delimiter so it never collides with `[[...]]`). It renders as a three-line stacked card (native / transliteration / English) in `chat-message.tsx`. Sentence blocks are NOT counted by the progress scorer — they only recombine already-taught words, so `countLearnings`/`parseTaughtTerms` stay on `[[...]]` only (no double-counting).
- The renderer (`chat-message.tsx`) walks `parseContentSegments` which interleaves text + `[[...]]` chips + `{{...}}` sentence cards in order. The prompt forbids markdown tables / stray pipe (`|`) characters outside the two block types (the `|` is reserved for inside `[[...]]`/`{{...}}`), since raw pipes from markdown tables would otherwise leak into the UI.
- This single markup drives BOTH the frontend rendering (chips/sentence cards in `chat-message.tsx`) AND server progress scoring (`countLearnings`). Both call into `@workspace/languages` — never reimplement parsing on either side.

## Where things live

- Language registry + markup: `@workspace/languages` (`lib/languages/src/registry.ts`, `markup.ts`)
- API contract source of truth: `lib/api-spec/openapi.yaml` — run codegen after editing
- Generated React Query hooks: `@workspace/api-client-react` (import from here, never relative paths)
- Generated Zod schemas: `@workspace/api-zod`
- DB schema: `lib/db/src/schema/` (`conversations.ts` — has `language` column, `messages.ts`)
- OpenAI server SDK wrapper: `@workspace/integrations-openai-ai-server` (exports `openai` client)
- Backend routes: `artifacts/api-server/src/routes/` — `openai.ts` (chat + conversation CRUD incl. PATCH language), `lessons.ts` (static lesson content, language-filtered), `progress.ts`
- Backend libs: `artifacts/api-server/src/lib/` — `llm.ts` (provider + per-language model), `progress.ts` (scoring), `lessons-data.ts` (`LESSONS_BY_LANGUAGE`)
- Frontend: `artifacts/tutor/src/` — `pages/` (chat, lessons, lesson-detail, settings), `components/`, `hooks/use-language.tsx` (LanguageProvider — holds BOTH the active language and active level), `hooks/use-chat.ts`
- Settings page: `artifacts/tutor/src/pages/settings.tsx` (route `/settings`, nav button in `layout.tsx`) — changes the active language and expertise level, sharing state with the sidebar language picker via `LanguageProvider`.
- SSE stream parser (frontend): `artifacts/tutor/src/lib/sse.ts`

## Architecture decisions

- Chat replies stream via Server-Sent Events from `POST /api/openai/conversations/{id}/messages`. Orval cannot type SSE, so this endpoint has NO generated hook — the frontend POSTs with `fetch` and parses the stream manually. All other endpoints use generated hooks.
- Conversations and messages are persisted in Postgres; full message history is replayed to the LLM as context on each turn (with the tutor system prompt prepended). Each conversation stores its target `language`; the chat handler builds the prompt and selects the model from that language.
- Per-conversation language: set at creation (`POST /conversations` accepts `language`) and changeable via `PATCH /conversations/:id`. The frontend's active/default language is held in `LanguageProvider` (localStorage); the in-chat language-change hint patches an existing conversation.
- Per-conversation level: mirrors language. `conversations.level` (default `beginner`) is set at creation (`POST /conversations` accepts `level`) and changeable via `PATCH /conversations/:id`. The active/default level is held in `LanguageProvider` alongside the language (localStorage key `tutor.activeLevel`). A reopened chat keeps the level it was started in.
- Lessons are static content served from `lessons-data.ts` (no DB table) — `LESSONS_BY_LANGUAGE` keyed by language code, generic `native`/`transliteration`/`english` phrase fields. The `lessons.ts` route filters by the `language` query param.
- The tutor system prompt is built per-language AND per-level by `buildSystemPrompt(language, level)` in `openai.ts`: it enforces the teaching style (mix English + target language) and the `[[native|translit|english]]` markup, injecting the language's `promptScriptNote` and `markupExample` plus the level's `promptNote` (beginners get heavy English scaffolding; advanced learners get richer vocabulary and more target-language usage). The prompt also tells the tutor to **match response length to the request**: a SPECIFIC "how do I say X" question gets only the requested translation plus 1–2 short variations of that same phrase (no unrelated padding, no repeating already-taught words); an OPEN-ENDED request may get a fuller multi-item lesson. The "always tell them what's next" momentum rule is preserved.
- Native script renders with per-language fonts and direction from the registry: `chat-message.tsx` and `lesson-detail.tsx` apply `language.fontClass` + `dir={language.direction}`. Fonts (Noto Nastaliq Urdu, Noto Sans Arabic/SC/JP/Devanagari) are loaded in `index.css` and exposed as `--font-*` theme tokens mirrored by the registry `fontClass` values.

## Product

- Chat tutor at `/` (and `/chat/:id`): pick a language in the sidebar, start/continue/delete conversations, streaming bilingual replies. A top progress bar shows progress toward today's per-language learning goal; the tutor proactively tells the student what to learn next and, once the daily goal is reached, congratulates them and offers to continue or rest till tomorrow. After a couple of messages, a dismissible hint lets the learner change the current conversation's language.
- Lessons browser at `/lessons` and `/lessons/:slug`: beginner topics for the active language, plus a "Practice in Chat" jump-off.
- Settings at `/settings`: change the active language and expertise level. These apply to NEW conversations and are shared with the sidebar language picker via `LanguageProvider` (persisted in localStorage).

## Daily progress

- Progress is derived (not stored) from taught terms in today's `assistant` messages, scoped to a single language (join on `conversations.language`). The daily goal is measured in WORDS learned today: scoring lives in `artifacts/api-server/src/lib/progress.ts` and counts via `countLearnings` from `@workspace/languages` (each taught term contributes its native word count, min 1; tune `DAILY_TARGET` there). `GET /api/progress/today?language=<code>` returns the daily summary including `wordsLearned`; the chat handler injects a per-turn progress directive (worded in words) into the LLM so it reacts to how close the student is to the goal. The frontend bar shows "N word(s) learned today".
- Scoring and frontend rendering BOTH go through the markup parser in `@workspace/languages` — keep all taught-term recognition there, never a side-specific regex.

## User preferences

- No emojis in the UI.

## Gotchas

- `tw-animate-css` `animate-in` does NOT apply `fill-mode: forwards` by default. Do NOT pair `animate-in fade-in` with a static `opacity-0` class — the element reverts to (or starts) invisible. Use `animate-in fade-in` alone, or set `animationFillMode: "both"` inline.
- Restart the `artifacts/api-server` workflow after adding/mounting new routes — the dev workflow builds once on start.
- LLM provider/model is resolved in `artifacts/api-server/src/lib/llm.ts` via `resolveModel(language)`. OpenRouter free models use `max_tokens`; the Replit `gpt-5.4` fallback needs `max_completion_tokens` — the chat route branches on `usingOpenRouter`. Model precedence on OpenRouter: global `OPENROUTER_MODEL` env override → the language's `model.openRouter` → shared default. Harder non-Latin scripts default to a stronger free model, Latin scripts to a lighter one.
- OpenRouter free model slugs (the `:free` ones) come and go and get rate-limited (HTTP 429) per upstream provider. If chat returns "Failed to generate a reply", check the api-server log for the OpenRouter error, then probe `GET https://openrouter.ai/api/v1/models` (filter pricing prompt+completion == 0) and set `OPENROUTER_MODEL` to a working one.
- Do not change the OpenAPI `info.title` — it controls generated filenames.
- Never use `console.log` in server code — use `req.log` in handlers, `logger` elsewhere.
- Adding a language is ideally just a new entry in `LANGUAGES` (registry) plus a `LESSONS_BY_LANGUAGE` block and, for a non-Latin script, a font in `index.css` + matching `--font-*` token. No prompt/scoring/render code should need touching.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `ai-integrations-openai` skill for the OpenAI integration setup
