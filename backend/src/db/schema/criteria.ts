import { pgTable, serial, text, numeric, timestamp, integer } from "drizzle-orm/pg-core";

export const criteriaTable = pgTable("criteria", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  weight: numeric("weight", { precision: 5, scale: 2 }).notNull().default("1"),
  type: text("type").notNull().default("rating"), // 'rating' | 'percentage' | 'value'
  targetValue: numeric("target_value", { precision: 15, scale: 2 }),
  unit: text("unit"), // e.g. '%', '$', 'units'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const criteriaGroupsTable = pgTable("criteria_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const criteriaGroupItemsTable = pgTable("criteria_group_items", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  criterionId: integer("criterion_id").notNull(),
});

export type Criterion = typeof criteriaTable.$inferSelect;
export type CriteriaGroup = typeof criteriaGroupsTable.$inferSelect;
export type CriteriaGroupItem = typeof criteriaGroupItemsTable.$inferSelect;
