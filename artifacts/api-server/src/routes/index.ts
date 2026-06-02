import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai";
import lessonsRouter from "./lessons";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/openai", openaiRouter);
router.use(lessonsRouter);

export default router;
