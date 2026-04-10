import "dotenv/config";
import { app } from "./app.js";
import { connectDatabase } from "./lib/database.js";
import { logger } from "./lib/logger.js";
import { ensureSuperAdmin } from "./seeds.js";

import "./models/index.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

async function start() {
  await connectDatabase();

  await ensureSuperAdmin();

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`CommsCRM backend running on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error(err, "Failed to start CRM backend");
  process.exit(1);
});
