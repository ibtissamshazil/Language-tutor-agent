// Learner expertise level — single source of truth.
//
// Like the language registry, this is shared by BOTH the API server (it shapes
// the teaching system prompt) and the frontend (the Settings picker), so the
// two sides can never drift apart. A conversation persists the level it was
// started in, so reopening an old chat keeps its teaching depth.

export type LevelCode = "beginner" | "intermediate" | "advanced";

export interface LevelDef {
  /** Short stable code persisted on conversations. */
  code: LevelCode;
  /** English display name, e.g. "Beginner". */
  name: string;
  /** One-line description shown in the Settings picker. */
  description: string;
  /** Teaching guidance injected into the tutor system prompt. */
  promptNote: string;
}

export const LEVELS: LevelDef[] = [
  {
    code: "beginner",
    name: "Beginner",
    description: "New to the language — start from the very basics.",
    promptNote:
      "The student is a complete beginner who knows little or none of the language. Start from the very basics (greetings, numbers, everyday words, simple sentences). Lean heavily on English scaffolding, introduce only a few simple items at a time, keep target-language usage minimal, and explain every term clearly.",
  },
  {
    code: "intermediate",
    name: "Intermediate",
    description: "Knows the basics — ready for more vocabulary and sentences.",
    promptNote:
      "The student already knows the basics. Move at a moderate pace, introduce more varied vocabulary and short everyday sentences, use a little more of the target language in examples, and keep explanations lighter than for a beginner.",
  },
  {
    code: "advanced",
    name: "Advanced",
    description: "Comfortable with everyday speech — wants depth and nuance.",
    promptNote:
      "The student is comfortable with everyday conversation. Use richer vocabulary, idioms and fuller phrases, give fewer hand-holds, keep English explanations concise, and use more of the target language in your examples.",
  },
];

/** The default level used when none is specified. */
export const DEFAULT_LEVEL_CODE: LevelCode = "beginner";

const LEVEL_BY_CODE = new Map(LEVELS.map((l) => [l.code, l]));

/** Look up a level by code, returning undefined if unknown. */
export function findLevel(code: string | undefined | null): LevelDef | undefined {
  if (!code) return undefined;
  return LEVEL_BY_CODE.get(code as LevelCode);
}

/** Look up a level by code, falling back to the default level. */
export function getLevel(code: string | undefined | null): LevelDef {
  return findLevel(code) ?? LEVEL_BY_CODE.get(DEFAULT_LEVEL_CODE)!;
}

/** All valid level codes (useful for validation). */
export const LEVEL_CODES: string[] = LEVELS.map((l) => l.code);

/** Whether a string is a known level code. */
export function isLevelCode(code: string): boolean {
  return LEVEL_BY_CODE.has(code as LevelCode);
}
