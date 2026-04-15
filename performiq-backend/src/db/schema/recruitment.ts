import { pgTable, serial, integer, text, timestamp, pgEnum, date } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { sitesTable } from "./sites";

export const jobStatusEnum = pgEnum("job_status", ["draft", "open", "on_hold", "closed", "filled"]);
export const candidateStageEnum = pgEnum("candidate_stage", ["applied", "screening", "interview", "offer", "hired", "rejected"]);

export const jobRequisitionsTable = pgTable("job_requisitions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  department: text("department"),
  siteId: integer("site_id").references(() => sitesTable.id),
  description: text("description"),
  requirements: text("requirements"),
  employmentType: text("employment_type").notNull().default("full_time"),
  status: jobStatusEnum("status").notNull().default("draft"),
  openings: integer("openings").notNull().default(1),
  hiringManagerId: integer("hiring_manager_id").references(() => usersTable.id),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  closingDate: date("closing_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const candidatesTable = pgTable("candidates", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobRequisitionsTable.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  surname: text("surname").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  resumeText: text("resume_text"),
  coverLetter: text("cover_letter"),
  stage: candidateStageEnum("stage").notNull().default("applied"),
  rating: integer("rating"),
  notes: text("notes"),
  interviewDate: timestamp("interview_date"),
  interviewNotes: text("interview_notes"),
  offerSalary: text("offer_salary"),
  offerNotes: text("offer_notes"),
  rejectionReason: text("rejection_reason"),
  hiredUserId: integer("hired_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type JobRequisition = typeof jobRequisitionsTable.$inferSelect;
export type Candidate = typeof candidatesTable.$inferSelect;
