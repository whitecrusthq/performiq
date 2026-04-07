import "dotenv/config";
import { spawn, spawnSync } from "child_process";
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
    const frontendDir = path.resolve(__dirname, "../../frontend");
    const vite = spawn("npx", ["vite", "--host", "0.0.0.0", "--port", "3000", "--strictPort"], {
      cwd: frontendDir,
      env: { ...process.env, FRONTEND_PORT: "3000" },
      stdio: "inherit",
    });
    vite.on("exit", (code) => {
      logger.warn({ code }, "PerformIQ Vite dev server exited");
    });
    logger.info("PerformIQ Vite dev server spawned on port 3000");

    const crmDir = path.resolve(__dirname, "../../commscrm-temp/backend");
    const crmDistPath = path.resolve(crmDir, "dist/index.mjs");
    const buildResult = spawnSync("npm", ["run", "build"], { cwd: crmDir, stdio: "inherit" });
    if (buildResult.status === 0) {
      logger.info("CommsCRM backend built successfully");
    } else {
      logger.error("Failed to build CommsCRM backend, using existing dist");
    }
    const crm = spawn("node", ["--enable-source-maps", crmDistPath], {
      cwd: crmDir,
      env: { ...process.env, CRM_PORT: "3002", NODE_ENV: "development" },
      stdio: "inherit",
    });
    crm.on("exit", (code) => {
      logger.warn({ code }, "CommsCRM server process exited");
    });
    logger.info("CommsCRM server spawned as child process");
  }
});
