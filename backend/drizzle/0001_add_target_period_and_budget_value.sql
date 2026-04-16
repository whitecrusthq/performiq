ALTER TABLE "criteria" ADD COLUMN IF NOT EXISTS "target_period" text;--> statement-breakpoint
ALTER TABLE "appraisal_scores" ADD COLUMN IF NOT EXISTS "budget_value" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "appraisal_scores" ALTER COLUMN "self_score" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "appraisal_scores" ALTER COLUMN "manager_score" SET DATA TYPE numeric(5, 2);
