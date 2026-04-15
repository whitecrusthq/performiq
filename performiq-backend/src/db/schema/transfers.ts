import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { sitesTable } from "./sites";

export const transferStatusEnum = pgEnum("transfer_status", ["pending", "approved", "rejected", "cancelled"]);

export const transferRequestsTable = pgTable("transfer_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  fromSiteId: integer("from_site_id").references(() => sitesTable.id),
  toSiteId: integer("to_site_id").notNull().references(() => sitesTable.id),
  fromDepartment: text("from_department"),
  toDepartment: text("to_department"),
  reason: text("reason").notNull(),
  effectiveDate: text("effective_date").notNull(),
  endDate: text("end_date"),
  status: transferStatusEnum("status").notNull().default("pending"),
  requestedById: integer("requested_by_id").notNull().references(() => usersTable.id),
  approvedById: integer("approved_by_id").references(() => usersTable.id),
  approvalNotes: text("approval_notes"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TransferRequest = typeof transferRequestsTable.$inferSelect;
