import "dotenv/config";
import { app } from "./app.js";
import { connectDatabase } from "./lib/database.js";
import { sequelize } from "./lib/database.js";
import { logger } from "./lib/logger.js";
import { seedDatabase } from "./seeds.js";

import "./models/index.js";

const PORT = parseInt(process.env.CRM_PORT ?? process.env.PORT ?? "3002", 10);

async function start() {
  await connectDatabase();

  try {
    await sequelize.query(`
      ALTER TABLE crm_campaigns
        ALTER COLUMN channel TYPE VARCHAR(50)
        USING channel::text;
    `);
  } catch (_) {}

  await sequelize.sync({ alter: true });
  logger.info("CRM database tables synced");

  await seedDatabase();

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`CommsCRM backend running on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error(err, "Failed to start CRM backend");
  process.exit(1);
});
