import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { csrfProtection } from "./lib/auth";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { trustIngressProxy } from "./lib/ingress";

const app: Express = express();
app.set("trust proxy", trustIngressProxy);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cookieParser());
app.use(csrfProtection);
app.use(express.json({ limit: "32kb" }));

app.use("/api", router);

export default app;
