-- Add user_id to issues and monitoring so each user sees only their data (new user = empty state).
ALTER TABLE "monitoring" ADD COLUMN IF NOT EXISTS "user_id" text;
--> statement-breakpoint
DROP INDEX IF EXISTS "monitoring_recording_id_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "monitoring_user_recording_idx" ON "monitoring" USING btree ("user_id","recording_id");
--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "user_id" text;
--> statement-breakpoint
ALTER TABLE "issues" DROP CONSTRAINT IF EXISTS "issues_recording_id_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "issues_user_recording_idx" ON "issues" USING btree ("user_id","recording_id");
