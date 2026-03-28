import "dotenv/config";
import { defineConfig } from "drizzle-kit";

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
const dbPassword = process.env.DB_PASSWORD as string;
const dbName = getRequiredDbEnv("DB_NAME");
const dbSslModeRaw = process.env.DB_SSL_MODE ?? "disable";
const dbSslMode = ["prefer", "require", "verify-ca"].includes(dbSslModeRaw)
  ? "verify-full"
  : dbSslModeRaw;

const drizzleDatabaseUrl = new URL(`postgresql://${dbHost}:${dbPort}/${dbName}`);
drizzleDatabaseUrl.username = dbUser;
drizzleDatabaseUrl.password = dbPassword;

if (dbSslMode !== "disable") {
  drizzleDatabaseUrl.searchParams.set("sslmode", dbSslMode);
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: drizzleDatabaseUrl.toString(),
  },
});
