import { pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Tracks which static lessons a learner has completed, scoped per language.
// This app is single-user (like conversations/progress), so completions are
// global rather than per-account: a row exists when the lesson identified by
// (language, lessonSlug) has been marked complete.
export const lessonCompletions = pgTable(
  "lesson_completions",
  {
    id: serial("id").primaryKey(),
    language: text("language").notNull(),
    lessonSlug: text("lesson_slug").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique().on(table.language, table.lessonSlug)],
);

export const insertLessonCompletionSchema = createInsertSchema(
  lessonCompletions,
).omit({
  id: true,
  completedAt: true,
});

export type LessonCompletion = typeof lessonCompletions.$inferSelect;
export type InsertLessonCompletion = z.infer<typeof insertLessonCompletionSchema>;
