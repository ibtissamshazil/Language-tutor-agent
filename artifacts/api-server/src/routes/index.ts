import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai";
import lessonsRouter from "./lessons";
import lessonCompletionsRouter from "./lesson-completions";
import progressRouter from "./progress";
import modelsRouter from "./models";
import authRouter from "./auth";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use(requireAuth);
router.use("/openai", openaiRouter);
router.use(lessonsRouter);
router.use("/lesson-completions", lessonCompletionsRouter);
router.use("/progress", progressRouter);
router.use(modelsRouter);

export default router;
