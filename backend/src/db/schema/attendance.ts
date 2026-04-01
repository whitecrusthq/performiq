import { pgTable, serial, integer, text, date, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const timesheetStatusEnum = pgEnum("timesheet_status", ["draft", "submitted", "approved", "rejected"]);

export const attendanceLogsTable = pgTable("attendance_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: date("date").notNull(),
  clockIn: timestamp("clock_in"),
  clockOut: timestamp("clock_out"),
  durationMinutes: integer("duration_minutes"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const timesheetsTable = pgTable("timesheets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  weekStart: date("week_start").notNull(),
  weekEnd: date("week_end").notNull(),
  totalMinutes: integer("total_minutes").notNull().default(0),
  status: timesheetStatusEnum("status").notNull().default("draft"),
  submittedAt: timestamp("submitted_at"),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectedBy: integer("rejected_by"),
  rejectedAt: timestamp("rejected_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const timesheetEntriesTable = pgTable("timesheet_entries", {
  id: serial("id").primaryKey(),
  timesheetId: integer("timesheet_id").notNull(),
  userId: integer("user_id").notNull(),
  date: date("date").notNull(),
  minutes: integer("minutes").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AttendanceLog = typeof attendanceLogsTable.$inferSelect;
export type Timesheet = typeof timesheetsTable.$inferSelect;
export type TimesheetEntry = typeof timesheetEntriesTable.$inferSelect;
