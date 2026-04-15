import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const departmentsTable = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Department = typeof departmentsTable.$inferSelect;
