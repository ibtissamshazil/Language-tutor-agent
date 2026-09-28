import { Router, type IRouter } from "express";
import { autoModelOrder, modelChoiceLocked } from "../lib/llm";
import { listAvailableModels } from "../lib/model-catalog";

const router: IRouter = Router();

router.get("/models", async (_req, res) => {
  const models = await listAvailableModels();
  res.json({ models, autoOrder: autoModelOrder(), locked: modelChoiceLocked });
});

export default router;
