import { pgTable, serial, integer, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const hrWorkflowTypeEnum = pgEnum("hr_workflow_type", ["onboarding", "offboarding"]);
export const hrWorkflowStatusEnum = pgEnum("hr_workflow_status", ["active", "completed", "cancelled"]);
export const hrTaskStatusEnum = pgEnum("hr_task_status", ["pending", "in_progress", "completed", "skipped"]);

export const workflowTemplatesTable = pgTable("workflow_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: hrWorkflowTypeEnum("type").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const templateTasksTable = pgTable("template_tasks", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => workflowTemplatesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  orderIndex: integer("order_index").notNull().default(0),
  defaultAssigneeRole: text("default_assignee_role"),
  dueInDays: integer("due_in_days"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workflowsTable = pgTable("onboarding_workflows", {
  id: serial("id").primaryKey(),
  type: hrWorkflowTypeEnum("type").notNull(),
  status: hrWorkflowStatusEnum("status").notNull().default("active"),
  employeeId: integer("employee_id").notNull().references(() => usersTable.id),
  templateId: integer("template_id").references(() => workflowTemplatesTable.id),
  title: text("title").notNull(),
  notes: text("notes"),
  startedById: integer("started_by_id").notNull().references(() => usersTable.id),
  startDate: timestamp("start_date").notNull().defaultNow(),
  targetCompletionDate: timestamp("target_completion_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const workflowTasksTable = pgTable("workflow_tasks", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull().references(() => workflowsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  orderIndex: integer("order_index").notNull().default(0),
  status: hrTaskStatusEnum("status").notNull().default("pending"),
  assigneeId: integer("assignee_id").references(() => usersTable.id),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  completedById: integer("completed_by_id").references(() => usersTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const onboardingDocumentsTable = pgTable("onboarding_documents", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull().references(() => workflowsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  fileData: text("file_data"),
  fileType: text("file_type"),
  notes: text("notes"),
  uploadedById: integer("uploaded_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WorkflowTemplate = typeof workflowTemplatesTable.$inferSelect;
export type TemplateTask = typeof templateTasksTable.$inferSelect;
export type Workflow = typeof workflowsTable.$inferSelect;
export type WorkflowTask = typeof workflowTasksTable.$inferSelect;
export type OnboardingDocument = typeof onboardingDocumentsTable.$inferSelect;
