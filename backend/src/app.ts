import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// Upload endpoints can be hit unauthenticated (token-based proxy upload and the
// public careers upload-url minting), so cap volume per IP to limit abuse/cost.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads from this IP, please try again later." },
});
app.use("/api/storage/proxy-upload", uploadLimiter);
app.use("/api/careers/upload-url", uploadLimiter);

// The sweep endpoint is triggered by an external scheduler and authenticated by
// a shared secret inside the handler; cap volume per IP to blunt brute-forcing
// of the secret. A once-a-minute cron stays well under this ceiling.
const cronLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/cron/sweep", cronLimiter);

app.use("/api", router);

if (process.env.NODE_ENV === "development") {
  // Dev only: proxy all non-API requests to the Vite dev server (HMR, etc).
  app.use(
    "/",
    createProxyMiddleware({
      target: `http://localhost:${process.env.FRONTEND_PORT || "5000"}`,
      changeOrigin: true,
      ws: true,
    }),
  );
} else {
  // Production: serve the built frontend directly from Express so that the API
  // (including PUT /api/storage/proxy-upload) and the SPA are served by the same
  // server. No Vite dev server / proxy is involved in production.
  const clientDist = path.resolve(__dirname, "../../frontend/dist");
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

export default app;
