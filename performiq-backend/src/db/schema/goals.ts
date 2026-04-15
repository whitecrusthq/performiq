import { pgTable, serial, integer, text, date, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const goalStatusEnum = pgEnum("goal_status", [
  "not_started",
  "in_progress",
  "completed",
  "cancelled",
]);

export const goalsTable = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  cycleId: integer("cycle_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: goalStatusEnum("status").notNull().default("not_started"),
  dueDate: date("due_date"),
  progress: integer("progress").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Goal = typeof goalsTable.$inferSelect;
