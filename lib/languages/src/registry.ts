// Single source of truth for the languages the tutor can teach.
//
// Both the API server (prompt building, model selection, progress scoring) and
// the web frontend (language picker, script rendering) read from THIS file so
// the two sides can never drift apart.

export type ScriptDirection = "ltr" | "rtl";

export interface LanguageModelConfig {
  /**
   * OpenRouter model slug used for this language. Harder scripts can point at a
   * stronger model. Always overridable via the OPENROUTER_MODEL env var and
   * falls back to the shared default when unset (see server `llm.ts`).
   */
  openRouter?: string;
}

export interface LanguageDef {
  /** Short stable code, e.g. "es", "ur", "zh". Persisted on conversations. */
  code: string;
  /** English display name, e.g. "Spanish". */
  name: string;
  /** Name written in the language itself, e.g. "Español". */
  nativeName: string;
  /** Writing direction of the native script. */
  direction: ScriptDirection;
  /**
   * Tailwind font utility class for native script ("" = default Latin sans).
   * Mirrored by the --font-* theme tokens in the frontend `index.css`.
   */
  fontClass: string;
  /** Whether a roman transliteration is meaningful (false for Latin scripts). */
  usesTransliteration: boolean;
  /** Native greeting shown on the chat empty-state. */
  greeting: string;
  /** A short note about the script, injected into the teaching prompt. */
  promptScriptNote: string;
  /** A concrete example of the taught-term markup for this language. */
  markupExample: string;
  /** Optional per-language model override. */
  model?: LanguageModelConfig;
}

// A capable free OpenRouter model reserved for harder, non-Latin scripts.
const STRONG_MODEL = "openai/gpt-oss-120b:free";
// A lighter free model that is plenty for Latin-script languages.
const LIGHT_MODEL = "openai/gpt-oss-20b:free";

export const LANGUAGES: LanguageDef[] = [
  {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    direction: "ltr",
    fontClass: "",
    usesTransliteration: false,
    greeting: "¡Hola! ¿Cómo estás?",
    promptScriptNote: "written in the Latin alphabet",
    markupExample: "[[hola||hello]]",
    model: { openRouter: LIGHT_MODEL },
  },
  {
    code: "fr",
    name: "French",
    nativeName: "Français",
    direction: "ltr",
    fontClass: "",
    usesTransliteration: false,
    greeting: "Bonjour ! Comment ça va ?",
    promptScriptNote: "written in the Latin alphabet",
    markupExample: "[[bonjour||hello]]",
    model: { openRouter: LIGHT_MODEL },
  },
  {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    direction: "ltr",
    fontClass: "",
    usesTransliteration: false,
    greeting: "Hallo! Wie geht's?",
    promptScriptNote: "written in the Latin alphabet",
    markupExample: "[[hallo||hello]]",
    model: { openRouter: LIGHT_MODEL },
  },
  {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    direction: "ltr",
    fontClass: "",
    usesTransliteration: false,
    greeting: "Ciao! Come stai?",
    promptScriptNote: "written in the Latin alphabet",
    markupExample: "[[ciao||hello]]",
    model: { openRouter: LIGHT_MODEL },
  },
  {
    code: "pt",
    name: "Portuguese",
    nativeName: "Português",
    direction: "ltr",
    fontClass: "",
    usesTransliteration: false,
    greeting: "Olá! Tudo bem?",
    promptScriptNote: "written in the Latin alphabet",
    markupExample: "[[olá||hello]]",
    model: { openRouter: LIGHT_MODEL },
  },
  {
    code: "zh",
    name: "Mandarin Chinese",
    nativeName: "中文",
    direction: "ltr",
    fontClass: "font-cjk-sc",
    usesTransliteration: true,
    greeting: "你好！",
    promptScriptNote: "written in simplified Chinese characters (Hanzi)",
    markupExample: "[[你好|nǐ hǎo|hello]]",
    model: { openRouter: STRONG_MODEL },
  },
  {
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    direction: "ltr",
    fontClass: "font-cjk-jp",
    usesTransliteration: true,
    greeting: "こんにちは！",
    promptScriptNote: "written in Japanese script (hiragana, katakana and kanji)",
    markupExample: "[[こんにちは|konnichiwa|hello]]",
    model: { openRouter: STRONG_MODEL },
  },
  {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    direction: "ltr",
    fontClass: "font-devanagari",
    usesTransliteration: true,
    greeting: "नमस्ते!",
    promptScriptNote: "written in the Devanagari script",
    markupExample: "[[नमस्ते|namaste|hello]]",
    model: { openRouter: STRONG_MODEL },
  },
  {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    direction: "rtl",
    fontClass: "font-arabic",
    usesTransliteration: true,
    greeting: "مرحبا!",
    promptScriptNote: "written right-to-left in the Arabic script",
    markupExample: "[[مرحبا|marhaba|hello]]",
    model: { openRouter: STRONG_MODEL },
  },
  {
    code: "ur",
    name: "Urdu",
    nativeName: "اردو",
    direction: "rtl",
    fontClass: "font-urdu",
    usesTransliteration: true,
    greeting: "السلام علیکم",
    promptScriptNote: "written right-to-left in the Nastaliq (Urdu) script",
    markupExample: "[[سلام|salaam|peace / hello]]",
    model: { openRouter: STRONG_MODEL },
  },
];

/** The default language used when none is specified. */
export const DEFAULT_LANGUAGE_CODE = "es";

const LANGUAGE_BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

/** Look up a language by code, returning undefined if unknown. */
export function findLanguage(code: string | undefined | null): LanguageDef | undefined {
  if (!code) return undefined;
  return LANGUAGE_BY_CODE.get(code);
}

/** Look up a language by code, falling back to the default language. */
export function getLanguage(code: string | undefined | null): LanguageDef {
  return findLanguage(code) ?? LANGUAGE_BY_CODE.get(DEFAULT_LANGUAGE_CODE)!;
}

/** All valid language codes (useful for validation). */
export const LANGUAGE_CODES: string[] = LANGUAGES.map((l) => l.code);

/** Whether a string is a known language code. */
export function isLanguageCode(code: string): boolean {
  return LANGUAGE_BY_CODE.has(code);
}
