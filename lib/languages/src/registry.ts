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
  /**
   * Optional deep brief for a spoken DIALECT, injected into the teaching prompt
   * as its own section. `promptScriptNote` is interpolated inline in several
   * sentences, so it must stay a short fragment; anything longer — sound
   * changes, verb particles, the vocabulary that betrays the wrong dialect —
   * belongs here. Only set this where authenticity is the point.
   */
  promptDialectBrief?: string;
  /** A concrete example of the taught-term markup for this language. */
  markupExample: string;
  /** Optional per-language model override. */
  model?: LanguageModelConfig;
}

// No language pins a model by default: the server walks a shared, ordered chain
// of free OpenRouter models (see api-server `llm.ts`), which is the only thing
// that survives free slugs being retired, flipped to paid, or rate-limited.
//
// `model.openRouter` stays available per language for the case where one
// language genuinely needs a specific model — but pinning one that is often
// rate-limited just adds a failed round trip before the chain takes over.

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
  },
  {
    code: "ar-sy",
    name: "Syrian Arabic",
    nativeName: "اللهجة الشامية",
    direction: "rtl",
    fontClass: "font-arabic",
    usesTransliteration: true,
    greeting: "أهلين! كيفك؟",
    promptScriptNote:
      "the everyday spoken Arabic of Damascus (Shami), written right-to-left in proper Arabic script with standard fusha spelling — the words are colloquial, the orthography is not",
    promptDialectBrief: [
      "DIALECT AUTHENTICITY — this is the single most important requirement of this conversation.",
      "You are teaching the speech of an educated native Damascene (شامي), the Arabic heard in the streets, homes and shops of Damascus. Every word you teach must be a word a Damascus native would actually say out loud today. If a phrase belongs to Modern Standard Arabic, to Egyptian, Gulf, Iraqi or Maghrebi Arabic, it is WRONG here, even when it is perfectly good Arabic.",
      "",
      "SPELLING (write dialect the way Syrians write it — in full Arabic script, spelled the fusha way):",
      "- Use standard Arabic orthography and correct hamza/ta-marbuta: كيفك، قديش، هلق، منيح، شو، مدرسة.",
      "- Keep the ETYMOLOGICAL letters even where Damascus pronunciation drops or shifts them: write قديش (pronounced addeesh), قلبي (albi), تلاتة، هاد. Never respell a word phonetically in Arabic letters.",
      "- NEVER write Arabic in Latin letters or chat-Arabic numerals (3, 7, 2, 5) inside the Arabic field — numerals belong to texting, not to teaching.",
      "",
      "PRONUNCIATION, shown in the transliteration field (roman letters only, no digits):",
      "- ق is a glottal stop in Damascus: قديش = ʾaddeesh, قلبي = ʾalbi, وقت = waʾet.",
      "- ث → t, ذ → d, ظ → ḍ/z: تلاتة tlaate, هاد haad.",
      "- ج is a soft French-style j (zh): جاج jaaj.",
      "- Damascene imala: final ة is -e not -a (مدرسة madrase, شوية shwayye), and long ā often leans toward ē.",
      "- Use ʾ for the glottal stop (from ق or hamza) and ʿ for ع. Write kh, gh, sh for خ، غ، ش.",
      "- The letter q must NEVER appear in a transliteration: ق is always ʾ here (قديش = ʾaddeesh, قهوة = ʾahwe, وقت = waʾet). Likewise keep transliteration spellings consistent between replies — كتير is kteer every time, not ktiir.",
      "- The Arabic field contains Arabic letters only. Never mix Latin letters into it, and never mix Arabic letters into the transliteration field.",
      "",
      "GRAMMAR that makes it sound native rather than translated:",
      "- Present tense takes the b- prefix: بشرب bishrab (I drink), بروح brooh (I go).",
      "- Right now = عم + verb: عم بشرب قهوة ʿam bishrab ʾahwe.",
      "- Future = رح or حـ: رح روح raḥ rooh, حروح ḥarooh. Never سوف.",
      "- Want / going to = بدي، بدك، بدو: بدي روح biddi rooh.",
      "- Negate verbs with ما (ما بعرف ma baʿref) and nouns/adjectives with مو (مو منيح mu mnih). Never ليس, never the Egyptian مش.",
      "- Question words: شو (what), ليش (why), وين (where), إيمتى (when), كيف (how), مين (who), قديش (how much). NEVER ماذا، لماذا، أين، متى، كيف حالك، كم.",
      "- Pronouns: أنا، إنت، إنتي، هوي، هيي، نحنا، إنتو، هنن. Demonstratives: هاد، هاي، هدول — not هذا، هذه، هؤلاء.",
      "- Existence: في / ما في (فيه/مافي in speech), e.g. ما في مي ma fi mayy.",
      "- Motion and place take عـ + ال, not إلى or لـ: عالسوق ʿas-souʾ (to/at the market), عالبيت ʿal-beit, عالشغل ʿash-shoghel.",
      "- Pick عم vs رح by what the English actually means: 'I am ...ing (right now)' = عم + verb (عم روح عالسوق ʿam rooh ʿas-souʾ), while 'I will / I'm going to' = رح + verb (رح روح raḥ rooh). Do not swap them.",
      "- Everyday adjectives, in the Damascene form: حلو ḥelu (beautiful / nice / lovely — this is the word for 'beautiful', for people, places and things alike), منيح mnih (good), بشع bshiʿ (ugly), غالي ghaali (expensive), رخيص rkhees (cheap), تعبان taʿbaan (tired), مبسوط mabsoot (happy), زعلان zaʿlaan (upset), جاهز jaahez (ready). Never reach for the MSA adjectives جميل، رائع، شيّق، ممتاز in their place — a Damascene says حلو or كتير حلو.",
      "- The transliteration must spell out the whole word as it is actually pronounced — هلق is hallaʾ, not halʾ. Never abbreviate or clip it.",
      "",
      "DAMASCENE TEXTURE — reach for these, they are what a native actually says:",
      "- هلق (now), لسا (still / not yet), كمان (also), شوي (a bit), كتير (very — never جداً), منيح (good), عنجد (really), خلص (that's it / done), يلا (come on), معليش (never mind), بكرا (tomorrow), مبارح (yesterday), هون (here), هونيك (there).",
      "- Social formulas Damascenes use constantly: أهلين (hi back), مرحبتين (reply to مرحبا), يسلمو (thanks) with الله يسلمك as the reply, يعطيك العافية with الله يعافيك, تكرم عينك (of course, gladly), على راسي (with pleasure), ولو! (don't mention it), تفضل (here you go / go ahead), صحتين (enjoy your meal), نعيماً (said after a haircut or shower).",
      "- Damascene warmth is part of the language: كيفك؟ شو أخبارك؟ شلونك is NOT Damascene — do not use it.",
      "",
      "FORBIDDEN — never teach these as Syrian, and correct them if the student uses them:",
      "- MSA: كيف حالك، ماذا، الآن، أريد، هذا، جداً، نعم، ليس، سوف، أين، لماذا.",
      "- Egyptian: إزيك، عايز، دلوقتي، إزاي، مش، ده.",
      "- Gulf/Iraqi: شلون، وايد، هسه، زين، چ for ك.",
      "When the natural Damascene word happens to be identical to the fusha word (مدرسة، كتاب، مي), that is fine — use it. The rule is not to avoid fusha vocabulary, it is to never use a fusha form where Damascus says something else.",
      "",
      "When a word or phrase is specifically Damascene rather than general Levantine, or when the fusha equivalent is what a textbook would have taught, say so in one short English aside — that contrast is exactly what makes the dialect stick.",
    ].join("\n"),
    markupExample: "[[كيفك|kifak|how are you]]",
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
