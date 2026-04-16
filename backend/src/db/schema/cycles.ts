import { pgTable, serial, text, date, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const cycleStatusEnum = pgEnum("cycle_status", ["draft", "active", "closed"]);

export const cyclesTable = pgTable("cycles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: cycleStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Cycle = typeof cyclesTable.$inferSelect;
