import { drizzle } from "drizzle-orm/node-postgres";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { logger } from "../lib/logger";
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

const resolveCaPath = (certificatePath: string) => {
  if (path.isAbsolute(certificatePath)) {
    return certificatePath;
  }

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), certificatePath),
    path.resolve(moduleDir, certificatePath),
    path.resolve(moduleDir, "..", certificatePath),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
};

const resolvedDbSslCaPath = dbSslCaPath ? resolveCaPath(dbSslCaPath) ?? dbSslCaPath : undefined;

const dbSslCa = resolvedDbSslCaPath
  ? fs.readFileSync(resolvedDbSslCaPath, "utf8")
  : undefined;

logger.info(
  {
    dbSslEnabled,
    dbSslCaPath,
    resolvedDbSslCaPath,
    dbSslCa,
  },
  "Loaded database SSL certificate",
);

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: dbSslEnabled
    ? {
        ca: dbSslCa,
        rejectUnauthorized: !!dbSslCa
      }
    : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
