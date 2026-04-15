ALTER TABLE "appraisal_scores" ADD COLUMN IF NOT EXISTS "admin_actual_value" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "appraisal_scores" ADD COLUMN IF NOT EXISTS "accepted_value" text;
