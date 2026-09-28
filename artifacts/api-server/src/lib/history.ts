// Turning a stored conversation into the messages a model is given.
//
// Normally the model sees the recent turns verbatim. When the student switches
// to a DIFFERENT model mid-conversation, the transcript stops being something
// the model wrote — and the new one may have a much smaller context window —
// so the older part is replaced with a short recap of what has already been
// taught. The chat itself is untouched: the student stays in the same
// conversation and simply keeps going.

import { parseTaughtTerms } from "@workspace/languages";
import type { LanguageDef } from "@workspace/languages";

export interface StoredMessage {
  role: string;
  content: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Turns kept word-for-word when the history is compacted. */
const KEEP_VERBATIM = 8;
/** Enough of a vocabulary recap to avoid re-teaching, without a wall of text. */
const MAX_RECAP_TERMS = 40;
/** Earlier questions worth carrying over, newest last. */
const MAX_RECAP_QUESTIONS = 4;

export function toChatTurns(history: StoredMessage[]): ChatTurn[] {
  return history.map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));
}

export interface CompactedHistory {
  /** A system message summarising the dropped turns, if any were dropped. */
  recap?: string;
  turns: ChatTurn[];
  compactedCount: number;
}

/**
 * Compact everything but the last few turns into one recap message.
 *
 * The recap is built from the tutor's own taught-term markup rather than by
 * asking a model to summarise: it is exact, free, and instant, and it carries
 * the one thing a replacement model must not get wrong — which words the
 * student has already been taught.
 */
export function compactHistory(
  history: StoredMessage[],
  language: LanguageDef,
): CompactedHistory {
  if (history.length <= KEEP_VERBATIM) {
    return { turns: toChatTurns(history), compactedCount: 0 };
  }

  const older = history.slice(0, history.length - KEEP_VERBATIM);
  const tail = history.slice(history.length - KEEP_VERBATIM);

  const taught = new Map<string, string>();
  for (const message of older) {
    if (message.role !== "assistant") continue;
    for (const term of parseTaughtTerms(message.content)) {
      if (!taught.has(term.native)) taught.set(term.native, term.english);
    }
  }
  const vocabulary = [...taught.entries()]
    .slice(-MAX_RECAP_TERMS)
    .map(([native, english]) => (english ? `${native} (${english})` : native))
    .join(", ");

  const questions = older
    .filter((m) => m.role === "user")
    .slice(-MAX_RECAP_QUESTIONS)
    .map((m) => `"${m.content.replace(/\s+/g, " ").slice(0, 80)}"`)
    .join(", ");

  const recap = [
    `Recap of the earlier part of this ${language.name} conversation, which is continuing with you now.`,
    "Pick it up mid-lesson: do not greet the student again, do not restart from the basics, and do not re-teach the words below as if they were new.",
    vocabulary ? `Already taught: ${vocabulary}.` : undefined,
    questions ? `Earlier the student asked: ${questions}.` : undefined,
    "The most recent turns follow in full.",
  ]
    .filter(Boolean)
    .join(" ");

  return { recap, turns: toChatTurns(tail), compactedCount: older.length };
}
