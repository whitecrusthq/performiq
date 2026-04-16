import { pgTable, serial, integer, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";

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
  criteriaGroupId: integer("criteria_group_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const appraisalScoresTable = pgTable("appraisal_scores", {
  id: serial("id").primaryKey(),
  appraisalId: integer("appraisal_id").notNull(),
  criterionId: integer("criterion_id").notNull(),
  selfScore: numeric("self_score", { precision: 5, scale: 2 }),
  managerScore: numeric("manager_score", { precision: 5, scale: 2 }),
  selfNote: text("self_note"),
  managerNote: text("manager_note"),
  actualValue: numeric("actual_value", { precision: 15, scale: 2 }),
  adminActualValue: numeric("admin_actual_value", { precision: 15, scale: 2 }),
  acceptedValue: text("accepted_value"),
  budgetValue: numeric("budget_value", { precision: 15, scale: 2 }),
});

export const appraisalReviewersTable = pgTable("appraisal_reviewers", {
  id: serial("id").primaryKey(),
  appraisalId: integer("appraisal_id").notNull(),
  reviewerId: integer("reviewer_id").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending | in_progress | completed
  managerComment: text("manager_comment"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const appraisalReviewerScoresTable = pgTable("appraisal_reviewer_scores", {
  id: serial("id").primaryKey(),
  appraisalId: integer("appraisal_id").notNull(),
  reviewerId: integer("reviewer_id").notNull(),
  criterionId: integer("criterion_id").notNull(),
  score: numeric("score", { precision: 5, scale: 2 }),
  note: text("note"),
  actualValue: numeric("actual_value", { precision: 15, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Appraisal = typeof appraisalsTable.$inferSelect;
export type AppraisalScore = typeof appraisalScoresTable.$inferSelect;
export type AppraisalReviewer = typeof appraisalReviewersTable.$inferSelect;
export type AppraisalReviewerScore = typeof appraisalReviewerScoresTable.$inferSelect;
