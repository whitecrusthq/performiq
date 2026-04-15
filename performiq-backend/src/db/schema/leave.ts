import { pgTable, serial, integer, text, date, timestamp, boolean, varchar } from "drizzle-orm/pg-core";

export const leaveTypesTable = pgTable("leave_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  label: varchar("label", { length: 200 }).notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leaveRequestsTable = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  leaveType: text("leave_type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  days: integer("days").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  reviewerId: integer("reviewer_id"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const leaveApproversTable = pgTable("leave_approvers", {
  id: serial("id").primaryKey(),
  leaveRequestId: integer("leave_request_id").notNull(),
  approverId: integer("approver_id").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leavePoliciesTable = pgTable("leave_policies", {
  id: serial("id").primaryKey(),
  leaveType: text("leave_type").notNull(),
  daysAllocated: integer("days_allocated").notNull().default(0),
  cycleStartMonth: integer("cycle_start_month").notNull().default(1),
  cycleStartDay: integer("cycle_start_day").notNull().default(1),
  cycleEndMonth: integer("cycle_end_month").notNull().default(12),
  cycleEndDay: integer("cycle_end_day").notNull().default(31),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const leaveAllocationsTable = pgTable("leave_allocations", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  leaveType: text("leave_type").notNull(),
  policyId: integer("policy_id"),
  allocated: integer("allocated").notNull().default(0),
  used: integer("used").notNull().default(0),
  cycleYear: integer("cycle_year").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type LeaveType = typeof leaveTypesTable.$inferSelect;
export type LeaveRequest = typeof leaveRequestsTable.$inferSelect;
export type LeaveApprover = typeof leaveApproversTable.$inferSelect;
export type LeavePolicy = typeof leavePoliciesTable.$inferSelect;
export type LeaveAllocation = typeof leaveAllocationsTable.$inferSelect;
