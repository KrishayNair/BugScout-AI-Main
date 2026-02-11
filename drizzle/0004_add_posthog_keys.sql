-- PostHog Personal API key per user (one per user). Add/remove from Integration page.
CREATE TABLE IF NOT EXISTS "developer_posthog_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL UNIQUE,
  "api_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
