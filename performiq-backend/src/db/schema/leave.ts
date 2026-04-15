import { pgTable, serial, integer, text, date, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const leaveTypeEnum = pgEnum("leave_type", ["annual", "sick", "personal", "maternity", "paternity", "unpaid", "other"]);
export const leaveStatusEnum = pgEnum("leave_status", ["pending", "approved", "rejected", "cancelled"]);

export const leaveRequestsTable = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  leaveType: leaveTypeEnum("leave_type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  days: integer("days").notNull(),
  reason: text("reason"),
  status: leaveStatusEnum("status").notNull().default("pending"),
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
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  note: text("note"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LeaveRequest = typeof leaveRequestsTable.$inferSelect;
export type LeaveApprover = typeof leaveApproversTable.$inferSelect;
