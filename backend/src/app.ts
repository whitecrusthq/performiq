import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  })
);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

app.use("/crm-api/auth/login", authLimiter);
app.use("/api/auth/login", authLimiter);

app.use("/crm-api", router);
app.use("/api", router);

if (process.env.NODE_ENV === "development") {
  const { createProxyMiddleware } = await import("http-proxy-middleware");
  app.use(
    "/",
    createProxyMiddleware({
      target: "http://localhost:3000",
      changeOrigin: true,
      ws: true,
      logLevel: "silent",
    })
  );
} else {
  const frontendDist = path.resolve(__dirname, "../frontend/dist/public");
  app.use(express.static(frontendDist));
  app.get("*path", (_req, res) => {
    res.sendFile(path.resolve(frontendDist, "index.html"));
  });
}

export { app };
