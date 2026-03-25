import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { createProxyMiddleware } from "http-proxy-middleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Proxy all other requests to the Laravel PHP app on port 8000
app.use(
  "/",
  createProxyMiddleware({
    target: "http://127.0.0.1:8000",
    changeOrigin: true,
    on: {
      error: (err, req, res) => {
        logger.error({ err }, "Proxy error");
        if (!res.headersSent) {
          (res as express.Response).status(502).send("Laravel app unavailable");
        }
      },
    },
  }),
);

export default app;
