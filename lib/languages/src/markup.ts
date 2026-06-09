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

// A full example SENTENCE the tutor writes out after teaching the individual
// words/phrases. It carries the same three fields as a taught term, but is
// rendered as three stacked lines (native / transliteration / english) instead
// of an inline chip. It uses a DIFFERENT delimiter ({{...}}) so it never
// collides with the [[...]] term markup and is NEVER counted by the progress
// scorer (it only recombines already-taught vocabulary).
export interface SentenceBlock {
  native: string;
  transliteration: string;
  english: string;
  raw: string;
  index: number;
}

const SENTENCE_REGEX = /\{\{([^}]+?)\}\}/g;

function splitThreeFields(inner: string): {
  native: string;
  transliteration: string;
  english: string;
} {
  const fields = inner.split("|").map((f) => f.trim());
  const native = fields[0] ?? "";
  let transliteration = "";
  let english = "";
  if (fields.length >= 3) {
    transliteration = fields[1] ?? "";
    english = fields.slice(2).join(" | ");
  } else if (fields.length === 2) {
    english = fields[1] ?? "";
  }
  return { native, transliteration, english };
}

/** Parse every example-sentence block ({{...}}) out of a piece of text, in order. */
export function parseSentenceBlocks(text: string): SentenceBlock[] {
  const blocks: SentenceBlock[] = [];
  let match: RegExpExecArray | null;
  SENTENCE_REGEX.lastIndex = 0;
  while ((match = SENTENCE_REGEX.exec(text)) !== null) {
    const { native, transliteration, english } = splitThreeFields(match[1]);
    if (!native) continue;
    blocks.push({
      native,
      transliteration,
      english,
      raw: match[0],
      index: match.index,
    });
  }
  return blocks;
}

/** An ordered segment of tutor content: plain text, a taught-term chip, or a sentence block. */
export type ContentSegment =
  | { type: "text"; value: string }
  | { type: "term"; term: TaughtTerm }
  | { type: "sentence"; sentence: SentenceBlock };

/**
 * Tokenize a tutor reply into ordered segments so the renderer can lay out
 * inline taught-term chips ([[...]]) and three-line example sentences ({{...}})
 * alongside plain text in a single pass. The scorer does NOT use this — it stays
 * on `countLearnings`/`parseTaughtTerms` so only [[...]] terms contribute points.
 */
export function parseContentSegments(text: string): ContentSegment[] {
  const marks = [
    ...parseTaughtTerms(text).map(
      (term) => ({ type: "term" as const, term, index: term.index, raw: term.raw }),
    ),
    ...parseSentenceBlocks(text).map(
      (sentence) => ({
        type: "sentence" as const,
        sentence,
        index: sentence.index,
        raw: sentence.raw,
      }),
    ),
  ].sort((a, b) => a.index - b.index);

  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  for (const mark of marks) {
    if (mark.index < lastIndex) continue; // skip overlaps (shouldn't happen)
    if (mark.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, mark.index) });
    }
    if (mark.type === "term") {
      segments.push({ type: "term", term: mark.term });
    } else {
      segments.push({ type: "sentence", sentence: mark.sentence });
    }
    lastIndex = mark.index + mark.raw.length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
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
