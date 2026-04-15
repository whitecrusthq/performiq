import { pgTable, serial, integer, text, date, timestamp, pgEnum, decimal } from "drizzle-orm/pg-core";

export const timesheetStatusEnum = pgEnum("timesheet_status", ["draft", "submitted", "approved", "rejected"]);

export const attendanceLogsTable = pgTable("attendance_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: date("date").notNull(),
  siteId: integer("site_id"),
  clockIn: timestamp("clock_in"),
  clockOut: timestamp("clock_out"),
  durationMinutes: integer("duration_minutes"),
  clockInLat: decimal("clock_in_lat", { precision: 10, scale: 7 }),
  clockInLng: decimal("clock_in_lng", { precision: 10, scale: 7 }),
  clockOutLat: decimal("clock_out_lat", { precision: 10, scale: 7 }),
  clockOutLng: decimal("clock_out_lng", { precision: 10, scale: 7 }),
  faceImageIn: text("face_image_in"),
  faceImageOut: text("face_image_out"),
  clockInPhotoTime: timestamp("clock_in_photo_time"),
  clockOutPhotoTime: timestamp("clock_out_photo_time"),
  notes: text("notes"),
  faceReviewStatus: text("face_review_status").default("pending"),
  faceReviewedBy: integer("face_reviewed_by"),
  faceReviewedAt: timestamp("face_reviewed_at"),
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

export const timesheetApproversTable = pgTable("timesheet_approvers", {
  id: serial("id").primaryKey(),
  timesheetId: integer("timesheet_id").notNull(),
  approverId: integer("approver_id").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  note: text("note"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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

export const attendanceLocationPingsTable = pgTable("attendance_location_pings", {
  id: serial("id").primaryKey(),
  attendanceLogId: integer("attendance_log_id").notNull(),
  userId: integer("user_id").notNull(),
  lat: decimal("lat", { precision: 10, scale: 7 }).notNull(),
  lng: decimal("lng", { precision: 10, scale: 7 }).notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export type AttendanceLog = typeof attendanceLogsTable.$inferSelect;
export type AttendanceLocationPing = typeof attendanceLocationPingsTable.$inferSelect;
export type Timesheet = typeof timesheetsTable.$inferSelect;
export type TimesheetEntry = typeof timesheetEntriesTable.$inferSelect;
export type TimesheetApprover = typeof timesheetApproversTable.$inferSelect;
