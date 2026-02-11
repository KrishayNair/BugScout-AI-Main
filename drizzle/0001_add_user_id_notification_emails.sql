-- Add user_id to developer_notification_emails and per-user unique (user_id, email).
-- Run this if the table already exists without user_id (e.g. created before per-user scoping).
ALTER TABLE "developer_notification_emails" ADD COLUMN IF NOT EXISTS "user_id" text;
--> statement-breakpoint
ALTER TABLE "developer_notification_emails" DROP CONSTRAINT IF EXISTS "developer_notification_emails_email_key";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "developer_notification_emails_user_email_idx" ON "developer_notification_emails" USING btree ("user_id","email");
