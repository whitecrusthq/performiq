import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { createProxyMiddleware } from "http-proxy-middleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req: any) => {
        const url = req.url || "";
        return !url.startsWith("/api");
      },
    },
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

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again after 15 minutes." },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/verify-otp", authLimiter);

app.use("/api", router);

if (process.env.NODE_ENV === "development") {
  app.use(
    "/",
    createProxyMiddleware({
      target: `http://localhost:${process.env.FRONTEND_PORT || "5000"}`,
      changeOrigin: true,
      ws: true,
    }),
  );
}

export default app;
