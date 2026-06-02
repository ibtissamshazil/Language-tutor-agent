// Daily learning-progress scoring.
//
// Progress is derived from the Urdu the tutor has actually taught today. Each
// Urdu run (a word or a phrase of consecutive Urdu words) is worth points equal
// to the number of Urdu words it contains, so a four-word sentence is worth more
// than a single word. This rewards both the NUMBER of learnings and their
// COMPLEXITY. Once the running total reaches DAILY_TARGET the day's goal is met.

export const DAILY_TARGET = 60;

// Arabic/Urdu unicode blocks. Consecutive Urdu words separated by spaces are
// grouped into a single run so a full sentence counts as one phrase.
const URDU_RUN_REGEX =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF](?:[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF \t]*[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])?/g;

export interface TextLearnings {
  /** Number of distinct Urdu runs (words or phrases) taught. */
  phrases: number;
  /** Weighted points: sum of Urdu word counts across all runs. */
  points: number;
}

/** Count the learnings (phrases + weighted points) contained in a piece of text. */
export function countLearnings(text: string): TextLearnings {
  let phrases = 0;
  let points = 0;
  const matches = text.match(URDU_RUN_REGEX);
  if (matches) {
    for (const run of matches) {
      const words = run.split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;
      phrases += 1;
      points += words.length;
    }
  }
  return { phrases, points };
}

export interface DailyProgress {
  points: number;
  target: number;
  percent: number;
  achieved: boolean;
  phrasesLearned: number;
}

/** Aggregate today's learnings across many assistant message contents. */
export function summarizeProgress(contents: string[]): DailyProgress {
  let points = 0;
  let phrasesLearned = 0;
  for (const content of contents) {
    const { phrases, points: p } = countLearnings(content);
    points += p;
    phrasesLearned += phrases;
  }
  const percent = Math.min(100, Math.round((points / DAILY_TARGET) * 100));
  return {
    points,
    target: DAILY_TARGET,
    percent,
    achieved: points >= DAILY_TARGET,
    phrasesLearned,
  };
}

/** Start of the current day (server local time) as a Date. */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
