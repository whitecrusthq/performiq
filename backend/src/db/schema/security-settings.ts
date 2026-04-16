import { pgTable, serial, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const securitySettingsTable = pgTable("security_settings", {
  id: serial("id").primaryKey(),
  lockoutEnabled: boolean("lockout_enabled").notNull().default(true),
  maxAttempts: integer("max_attempts").notNull().default(5),
  lockoutDurationMinutes: integer("lockout_duration_minutes").notNull().default(30),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SecuritySettings = typeof securitySettingsTable.$inferSelect;
