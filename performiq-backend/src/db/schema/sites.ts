import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const sitesTable = pgTable("sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Site = typeof sitesTable.$inferSelect;
