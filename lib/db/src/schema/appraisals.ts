import { pgTable, serial, integer, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appraisalStatusEnum = pgEnum("appraisal_status", [
  "pending",
  "self_review",
  "manager_review",
  "pending_approval",
  "completed",
]);

export const workflowTypeEnum = pgEnum("workflow_type", [
  "self_only",
  "manager_review",
  "admin_approval",
]);

export const appraisalsTable = pgTable("appraisals", {
  id: serial("id").primaryKey(),
  cycleId: integer("cycle_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  reviewerId: integer("reviewer_id"),
  status: appraisalStatusEnum("status").notNull().default("pending"),
  workflowType: workflowTypeEnum("workflow_type").notNull().default("admin_approval"),
  selfComment: text("self_comment"),
  managerComment: text("manager_comment"),
  overallScore: numeric("overall_score", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const appraisalScoresTable = pgTable("appraisal_scores", {
  id: serial("id").primaryKey(),
  appraisalId: integer("appraisal_id").notNull(),
  criterionId: integer("criterion_id").notNull(),
  selfScore: numeric("self_score", { precision: 3, scale: 1 }),
  managerScore: numeric("manager_score", { precision: 3, scale: 1 }),
  selfNote: text("self_note"),
  managerNote: text("manager_note"),
});

export const insertAppraisalSchema = createInsertSchema(appraisalsTable).omit({ id: true, createdAt: true });
export type InsertAppraisal = z.infer<typeof insertAppraisalSchema>;
export type Appraisal = typeof appraisalsTable.$inferSelect;
export type AppraisalScore = typeof appraisalScoresTable.$inferSelect;
