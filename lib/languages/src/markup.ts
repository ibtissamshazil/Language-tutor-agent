// Universal taught-term markup.
//
// The tutor wraps every target-language term it teaches in a consistent,
// machine-detectable markup so that BOTH the server progress scorer and the
// frontend renderer can find taught terms regardless of script (Latin or not):
//
//   [[native|transliteration|english]]
//
// e.g. [[hola||hello]] (Spanish, no transliteration) or
//      [[سلام|salaam|peace / hello]] (Urdu).
//
// This is the single parsing implementation shared by the server and the
// frontend — keep all term detection going through here so the two stay in
// lockstep.

export interface TaughtTerm {
  /** The term in the target language's native script. */
  native: string;
  /** Roman transliteration (may be empty for Latin-script languages). */
  transliteration: string;
  /** English meaning. */
  english: string;
  /** The full matched markup, e.g. "[[hola||hello]]". */
  raw: string;
  /** Start index of the match within the source text. */
  index: number;
}

// Matches a [[...]] block. The inner content is captured lazily so adjacent
// blocks are matched separately.
const TERM_REGEX = /\[\[([^\]]+?)\]\]/g;

/** Parse every taught-term markup block out of a piece of text, in order. */
export function parseTaughtTerms(text: string): TaughtTerm[] {
  const terms: TaughtTerm[] = [];
  let match: RegExpExecArray | null;
  TERM_REGEX.lastIndex = 0;
  while ((match = TERM_REGEX.exec(text)) !== null) {
    const inner = match[1];
    const fields = inner.split("|").map((f) => f.trim());
    const native = fields[0] ?? "";
    if (!native) continue;
    let transliteration = "";
    let english = "";
    if (fields.length >= 3) {
      transliteration = fields[1] ?? "";
      english = fields.slice(2).join(" | ");
    } else if (fields.length === 2) {
      // Two fields: treat as native + english (no transliteration).
      english = fields[1] ?? "";
    }
    terms.push({
      native,
      transliteration,
      english,
      raw: match[0],
      index: match.index,
    });
  }
  return terms;
}

export interface TextLearnings {
  /** Number of distinct taught terms (markup blocks) found. */
  phrases: number;
  /** Weighted points: sum of native word counts (min 1 per term). */
  points: number;
}

/**
 * Count the learnings contained in a piece of text via the taught-term markup.
 *
 * Points reward both the NUMBER of taught terms and their COMPLEXITY: each term
 * is worth the number of whitespace-separated words in its native form, with a
 * floor of 1 so every taught term scores (this is what makes scoring work for
 * single-token, space-less scripts like Chinese as well as multi-word Latin
 * phrases).
 */
export function countLearnings(text: string): TextLearnings {
  const terms = parseTaughtTerms(text);
  let points = 0;
  for (const term of terms) {
    const words = term.native.split(/\s+/).filter(Boolean).length;
    points += Math.max(1, words);
  }
  return { phrases: terms.length, points };
}
