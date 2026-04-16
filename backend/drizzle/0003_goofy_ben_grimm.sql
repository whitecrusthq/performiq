CREATE TABLE "leave_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"leave_type" "leave_type" NOT NULL,
	"policy_id" integer,
	"allocated" integer DEFAULT 0 NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"cycle_year" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"leave_type" "leave_type" NOT NULL,
	"days_allocated" integer DEFAULT 0 NOT NULL,
	"cycle_start_month" integer DEFAULT 1 NOT NULL,
	"cycle_start_day" integer DEFAULT 1 NOT NULL,
	"cycle_end_month" integer DEFAULT 12 NOT NULL,
	"cycle_end_day" integer DEFAULT 31 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "criteria" ADD COLUMN "target_period" text;--> statement-breakpoint
ALTER TABLE "appraisal_scores" ADD COLUMN "admin_actual_value" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "appraisal_scores" ADD COLUMN "accepted_value" text;--> statement-breakpoint
ALTER TABLE "appraisal_scores" ADD COLUMN "budget_value" numeric(15, 2);