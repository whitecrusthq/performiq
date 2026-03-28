import "dotenv/config";
import { defineConfig } from "drizzle-kit";

type DrizzleSslMode = "allow" | "prefer" | "require" | "verify-full" | undefined;

const getRequiredDbEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set for drizzle-kit.`);
  }

  return value;
};

const dbHost = getRequiredDbEnv("DB_HOST");
const dbPort = process.env.DB_PORT ?? "5432";
const dbUser = getRequiredDbEnv("DB_USER");
const dbName = getRequiredDbEnv("DB_NAME");
const dbSslModeRaw = process.env.DB_SSL_MODE ?? "disable";
const dbSslMode: DrizzleSslMode = ["prefer", "require", "verify-ca"].includes(dbSslModeRaw)
  ? "verify-full"
  : dbSslModeRaw === "allow"
    ? "allow"
    : undefined;

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: dbHost,
    port: Number(dbPort),
    user: dbUser,
    password: process.env.DB_PASSWORD?.trim() || undefined,
    database: dbName,
    ssl: dbSslMode,
  },
});
