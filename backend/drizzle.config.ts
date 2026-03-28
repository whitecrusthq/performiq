import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";
import { parse as parseDotenv } from "dotenv";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const dotenvCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(configDir, ".env"),
];

const dotenvPath = dotenvCandidates.find((candidate) => fs.existsSync(candidate));
const dotenvValues = dotenvPath
  ? parseDotenv(fs.readFileSync(dotenvPath, "utf8"))
  : {};

type DrizzleSslMode = "allow" | "prefer" | "require" | "verify-full" | undefined;

const getEnv = (name: string) => process.env[name] ?? dotenvValues[name];

const databaseUrl = getEnv("DATABASE_URL");
const dbUrl = databaseUrl ? new URL(databaseUrl) : undefined;

const dbHost = getEnv("DB_HOST") ?? dbUrl?.hostname;
const dbPort = getEnv("DB_PORT") ?? (dbUrl?.port || "5432");
const dbUser = getEnv("DB_USER") ?? (dbUrl ? decodeURIComponent(dbUrl.username) : undefined);
const dbPasswordRaw = getEnv("DB_PASSWORD") ?? (dbUrl ? decodeURIComponent(dbUrl.password) : undefined);
const dbName = getEnv("DB_NAME") ?? dbUrl?.pathname.replace(/^\//, "");
const dbSslModeRaw = getEnv("DB_SSL_MODE") ?? dbUrl?.searchParams.get("sslmode") ?? "disable";
const dbSslMode: DrizzleSslMode = dbSslModeRaw === "require" ? "require" : undefined;

if (!dbHost || !dbUser || !dbName) {
  throw new Error("Missing DB config. Set DB_HOST/DB_USER/DB_NAME or provide DATABASE_URL.");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  migrations: {
    table: 'migrations',
    schema: 'public',
  },
  dbCredentials: {
    host: dbHost,
    port: Number(dbPort),
    user: dbUser,
    password: dbPasswordRaw?.trim() || undefined,
    database: dbName,
    ssl: dbSslMode,
  },
});
