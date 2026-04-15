import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const confirmationReviewsTable = pgTable("confirmation_reviews", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  appraisalId: integer("appraisal_id"),
  status: text("status").notNull().default("pending_appraisal"),
  reviewDocumentPath: text("review_document_path"),
  reviewDocumentName: text("review_document_name"),
  reviewerNotes: text("reviewer_notes"),
  initiatedBy: integer("initiated_by").notNull(),
  approvedBy: integer("approved_by"),
  rejectedReason: text("rejected_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
