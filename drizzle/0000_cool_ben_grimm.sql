CREATE TABLE IF NOT EXISTS "developer_notification_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issue_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"instruction" text NOT NULL,
	"suggested_fix_after" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" text NOT NULL,
	"posthog_category_id" text NOT NULL,
	"posthog_issue_type_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"severity" text NOT NULL,
	"code_location" text NOT NULL,
	"code_snippet_hint" text,
	"start_url" text,
	"suggested_fix" text,
	"status" text DEFAULT 'Unresolved' NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"approved_rating" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issues_recording_id_unique" UNIQUE("recording_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid,
	"recording_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"severity" text NOT NULL,
	"suggested_fix" text NOT NULL,
	"developer_rating" integer,
	"agent_confidence_score" numeric(3, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitoring" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" text NOT NULL,
	"distinct_id" text,
	"recording_duration" integer,
	"start_time" timestamp with time zone,
	"click_count" integer,
	"console_error_count" integer,
	"rage_click_count" integer,
	"dead_click_count" integer,
	"start_url" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posthog_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"posthog_event_id" text NOT NULL,
	"event_name" text NOT NULL,
	"distinct_id" text,
	"timestamp" timestamp with time zone NOT NULL,
	"url" text,
	"element_tag" text,
	"element_text" text,
	"session_id" text,
	"properties" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_revisions" ADD CONSTRAINT "issue_revisions_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "logs" ADD CONSTRAINT "logs_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "developer_notification_emails_user_email_idx" ON "developer_notification_emails" USING btree ("user_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "monitoring_recording_id_idx" ON "monitoring" USING btree ("recording_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "posthog_events_posthog_event_id_idx" ON "posthog_events" USING btree ("posthog_event_id");