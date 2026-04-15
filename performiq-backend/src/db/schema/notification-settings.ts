import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const notificationSettingsTable = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  config: jsonb("config").notNull().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedById: text("updated_by_id"),
});

export type NotificationSettings = typeof notificationSettingsTable.$inferSelect;
