import { drizzle } from "drizzle-orm/node-postgres";
import fs from "node:fs";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = process.env.DATABASE_URL;
const dbSslEnabled = databaseUrl.includes("sslmode=require");
const dbSslCaPath = process.env.DB_SSL_CA_PATH;

const dbSslCa = dbSslCaPath
  ? fs.readFileSync(dbSslCaPath, "utf8")
  : undefined;

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: dbSslEnabled
    ? {
        ca: dbSslCa,
      }
    : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
