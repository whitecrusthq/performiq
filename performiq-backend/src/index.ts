import "dotenv/config";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import app from "./app";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  if (process.env.NODE_ENV === "development") {
    const frontendDir = path.resolve(__dirname, "../../performiq-frontend");
    const viteBin = path.resolve(frontendDir, "node_modules/.bin/vite");
    const basePath = process.env.BASE_PATH || "/";
    const frontendPort = process.env.FRONTEND_PORT || "5000";
    const vite = spawn(viteBin, ["--host", "0.0.0.0", "--port", frontendPort, "--strictPort"], {
      cwd: frontendDir,
      env: { ...process.env, FRONTEND_PORT: frontendPort, BASE_PATH: basePath },
      stdio: "inherit",
    });
    vite.on("exit", (code) => {
      logger.warn({ code }, "PerformIQ Vite dev server exited");
    });
    logger.info({ frontendPort }, "PerformIQ Vite dev server spawned");
  }
});
