import "dotenv/config";
import { connectDatabase } from "./lib/database.js";
import { logger } from "./lib/logger.js";
import { seedDatabase } from "./seeds.js";

import "./models/index.js";

async function run() {
    await connectDatabase();
    await seedDatabase();
    logger.info("Seeding complete");
    process.exit(0);
}

run().catch((err) => {
    logger.error(err, "Seeding failed");
    process.exit(1);
});
