import { Router, type IRouter } from "express";
import { getLanguage } from "@workspace/languages";
import { LESSONS_BY_LANGUAGE } from "../lib/lessons-data";

const router: IRouter = Router();

function lessonsFor(languageQuery: unknown) {
  const language = getLanguage(
    typeof languageQuery === "string" ? languageQuery : undefined,
  );
  // Every registered language has lesson content; fall back defensively to the
  // resolved default's set if somehow missing.
  return {
    language,
    lessons: LESSONS_BY_LANGUAGE[language.code] ?? [],
  };
}

router.get("/lessons", (req, res) => {
  const { lessons } = lessonsFor(req.query.language);
  res.json(lessons);
});

router.get("/lessons/:slug", (req, res) => {
  const { lessons } = lessonsFor(req.query.language);
  const lesson = lessons.find((l) => l.slug === req.params.slug);
  if (!lesson) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }
  res.json(lesson);
});

export default router;
