// Daily learning-progress scoring.
//
// Progress is derived from the target-language terms the tutor has actually
// taught today. The tutor wraps every taught term in the universal markup
// ([[native|translit|english]]); both this scorer and the frontend renderer
// parse that SAME markup (via @workspace/languages) so they stay in lockstep
// and so scoring works for every language — Latin-script ones included, which a
// unicode-range scan could never distinguish from the surrounding English.
//
// Each taught term is worth points equal to the number of words in its native
// form (floor of 1), so a multi-word phrase is worth more than a single word
// while a single, space-less CJK term still scores. Once the running total
// reaches DAILY_TARGET the day's goal is met.

import { countLearnings } from "@workspace/languages";

// The daily goal is measured in WORDS learned today. Each taught term
// contributes the number of words in its native form (min 1), so this is the
// same total as the weighted `points` from the markup scorer.
export const DAILY_TARGET = 25;

export interface DailyProgress {
  points: number;
  target: number;
  percent: number;
  achieved: boolean;
  wordsLearned: number;
}

/** Aggregate today's learnings across many assistant message contents. */
export function summarizeProgress(contents: string[]): DailyProgress {
  let points = 0;
  for (const content of contents) {
    const { points: p } = countLearnings(content);
    points += p;
  }
  const percent = Math.min(100, Math.round((points / DAILY_TARGET) * 100));
  return {
    points,
    target: DAILY_TARGET,
    percent,
    achieved: points >= DAILY_TARGET,
    // Words learned today is the goal unit; it equals the weighted point total
    // (each taught term scores its native word count, floor of 1).
    wordsLearned: points,
  };
}

/** Start of the current day (server local time) as a Date. */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
