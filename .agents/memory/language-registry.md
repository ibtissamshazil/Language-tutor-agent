---
name: Language registry
description: The single source of truth that drives every language-dependent behavior in the tutor
---

# Language registry (`@workspace/languages`)

`lib/languages/src/registry.ts` defines `LANGUAGES: LanguageDef[]` — the ONE place
that lists what the multi-language tutor can teach. Both the API server (prompt
building, model selection, progress scoring) and the frontend (language picker,
script rendering, lessons) import from it, so the two sides cannot drift.

Each `LanguageDef` carries everything a behavior needs from a single record:
`code` (stable, persisted on `conversations.language`), display names, `direction`
(ltr/rtl), `fontClass` (Tailwind font utility, mirrored by `--font-*` tokens in the
frontend `index.css`), `usesTransliteration`, `greeting`, `promptScriptNote` +
`markupExample` (injected into the prompt), and optional `model.openRouter`.

`markup.ts` (same package) holds the universal taught-term parser/scorer
(`parseTaughtTerms`, `countLearnings`) over the `[[native|translit|english]]`
format — see daily-progress-system.md.

**Why one registry:** before, behavior was Urdu-specific and spread across server
and client (e.g. a unicode regex duplicated on both sides). Centralizing makes
adding a language a data change, and makes server/client divergence structurally
impossible.

**How to apply:** to add a language, add an entry to `LANGUAGES`, add a
`LESSONS_BY_LANGUAGE` block in the server `lessons-data.ts`, and for a non-Latin
script add the font in `index.css` + a matching `--font-*` token. No prompt,
scoring, or render code should need editing. Model precedence on OpenRouter:
global `OPENROUTER_MODEL` env → the language's `model.openRouter` → shared default.
