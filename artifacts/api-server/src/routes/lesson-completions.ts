import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, lessonCompletions } from "@workspace/db";
import { getLanguage } from "@workspace/languages";
import { MarkLessonCompletedBody } from "@workspace/api-zod";
import { LESSONS_BY_LANGUAGE } from "../lib/lessons-data";

const router: IRouter = Router();

// Returns the slugs of completed lessons for a language, filtered to slugs that
// actually exist in the lesson content so stale rows never leak to the client.
async function completionsFor(languageCode: string): Promise<string[]> {
  const validSlugs = new Set(
    (LESSONS_BY_LANGUAGE[languageCode] ?? []).map((l) => l.slug),
  );
  const rows = await db
    .select({ lessonSlug: lessonCompletions.lessonSlug })
    .from(lessonCompletions)
    .where(eq(lessonCompletions.language, languageCode));
  return rows.map((r) => r.lessonSlug).filter((slug) => validSlugs.has(slug));
}

// List completed lesson slugs for a language (single-user app).
router.get("/", async (req, res) => {
  const language = getLanguage(
    typeof req.query.language === "string" ? req.query.language : undefined,
  );
  const completedSlugs = await completionsFor(language.code);
  res.json({ language: language.code, completedSlugs });
});

// Mark a lesson complete for a language. Idempotent: re-marking is a no-op.
router.post("/", async (req, res) => {
  const parsed = MarkLessonCompletedBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const language = getLanguage(parsed.data.language);
  const { slug } = parsed.data;

  const exists = (LESSONS_BY_LANGUAGE[language.code] ?? []).some(
    (l) => l.slug === slug,
  );
  if (!exists) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }

  await db
    .insert(lessonCompletions)
    .values({ language: language.code, lessonSlug: slug })
    .onConflictDoNothing();

  const completedSlugs = await completionsFor(language.code);
  res.json({ language: language.code, completedSlugs });
});

// Unmark a completed lesson for a language.
router.delete("/:slug", async (req, res) => {
  const language = getLanguage(
    typeof req.query.language === "string" ? req.query.language : undefined,
  );
  await db
    .delete(lessonCompletions)
    .where(
      and(
        eq(lessonCompletions.language, language.code),
        eq(lessonCompletions.lessonSlug, req.params.slug),
      ),
    );
  const completedSlugs = await completionsFor(language.code);
  res.json({ language: language.code, completedSlugs });
});

export default router;
