-- Slack webhook URLs per user for issue notifications (add/remove from Integration page).
CREATE TABLE IF NOT EXISTS "developer_slack_webhooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "webhook_url" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "developer_slack_webhooks_user_url_idx" ON "developer_slack_webhooks" USING btree ("user_id","webhook_url");
