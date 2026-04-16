CREATE TABLE "disciplinary_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"object_path" text NOT NULL,
	"uploaded_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disciplinary_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text DEFAULT 'disciplinary' NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"sanction_applied" text,
	"severity" text DEFAULT 'minor' NOT NULL,
	"incident_date" date,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"label" varchar(200) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leave_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "leave_allocations" ALTER COLUMN "leave_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "leave_policies" ALTER COLUMN "leave_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "leave_requests" ALTER COLUMN "leave_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "leave_requests" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "leave_requests" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "leave_policies" ADD COLUMN "cycle_mode" text DEFAULT 'dates' NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD COLUMN "cycle_days" integer DEFAULT 365 NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD COLUMN "rollover_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD COLUMN "max_rollover_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "disciplinary_attachments" ADD CONSTRAINT "disciplinary_attachments_record_id_disciplinary_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."disciplinary_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplinary_records" ADD CONSTRAINT "disciplinary_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."leave_status";--> statement-breakpoint
DROP TYPE "public"."leave_type";