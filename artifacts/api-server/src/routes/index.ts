import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai";
import lessonsRouter from "./lessons";
import lessonCompletionsRouter from "./lesson-completions";
import progressRouter from "./progress";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/openai", openaiRouter);
router.use(lessonsRouter);
router.use("/lesson-completions", lessonCompletionsRouter);
router.use("/progress", progressRouter);

export default router;
