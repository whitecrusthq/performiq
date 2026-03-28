import { drizzle } from "drizzle-orm/node-postgres";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { logger } from "../lib/logger";
import * as schema from "./schema";

const { Pool } = pg;

const getRequiredDbEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set for database connectivity.`);
  }

  return value;
};

const dbHost = getRequiredDbEnv("DB_HOST");
const dbPortRaw = process.env.DB_PORT ?? "5432";
const dbPort = Number(dbPortRaw);
const dbUser = getRequiredDbEnv("DB_USER");
const dbPassword = process.env.DB_PASSWORD;
const dbName = getRequiredDbEnv("DB_NAME");
const dbSslModeRaw = process.env.DB_SSL_MODE ?? "disable";
const dbSslMode = ["prefer", "require", "verify-ca"].includes(dbSslModeRaw)
  ? "verify-full"
  : dbSslModeRaw;
const dbSslEnabled = dbSslMode !== "disable";
const dbSslCaPath = process.env.DB_SSL_CA_PATH;

if (Number.isNaN(dbPort) || dbPort <= 0) {
  throw new Error(`DB_PORT must be a positive number. Received: "${dbPortRaw}"`);
}

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

export const pool = new Pool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  ssl: dbSslEnabled
    ? {
        ca: dbSslCa,
        rejectUnauthorized: dbSslMode === "verify-full" || Boolean(dbSslCa),
      }
    : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
