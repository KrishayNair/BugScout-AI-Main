import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  decimal,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * PostHog session/recording data. Only new records inserted (recording_id unique per user).
 * Scoped by userId (Clerk) so each user sees only their sessions.
 */
export const monitoring = pgTable(
  "monitoring",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"), // Clerk user id; null = legacy
    recordingId: text("recording_id").notNull(),
    distinctId: text("distinct_id"),
    recordingDuration: integer("recording_duration"),
    startTime: timestamp("start_time", { withTimezone: true }),
    clickCount: integer("click_count"),
    consoleErrorCount: integer("console_error_count"),
    rageClickCount: integer("rage_click_count"),
    deadClickCount: integer("dead_click_count"),
    startUrl: text("start_url"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("monitoring_user_recording_idx").on(t.userId, t.recordingId)]
);

/**
 * Issues from Issue Monitoring Agent + resolution/approval state.
 * One row per (user, recording). Scoped by userId (Clerk) so each user sees only their issues.
 */
export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"), // Clerk user id; null = legacy
    recordingId: text("recording_id").notNull(),
  posthogCategoryId: text("posthog_category_id").notNull(),
  posthogIssueTypeId: text("posthog_issue_type_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(), // Critical | High | Medium | Low
  codeLocation: text("code_location").notNull(),
  codeSnippetHint: text("code_snippet_hint"),
  startUrl: text("start_url"),
  suggestedFix: text("suggested_fix"),
  status: text("status").notNull().default("Unresolved"), // Unresolved | Resolved
  approved: boolean("approved").notNull().default(false),
  approvedRating: integer("approved_rating"), // 1-5 when approved
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("issues_user_recording_idx").on(t.userId, t.recordingId)]
);

/**
 * Revision instructions and resulting fix (multiple per issue).
 */
export const issueRevisions = pgTable("issue_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  instruction: text("instruction").notNull(),
  suggestedFixAfter: text("suggested_fix_after"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Logs for agent context: approved fixes + optional confidence.
 * When the same/similar issue appears, agent can query logs to suggest from past solutions.
 */
export const logs = pgTable("logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id").references(() => issues.id),
  recordingId: text("recording_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(),
  suggestedFix: text("suggested_fix").notNull(),
  developerRating: integer("developer_rating"), // 1-5 when approved
  agentConfidenceScore: decimal("agent_confidence_score", { precision: 3, scale: 2 }), // 0.00-1.00 when agent used this log
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MonitoringRow = typeof monitoring.$inferSelect;
export type MonitoringInsert = typeof monitoring.$inferInsert;
export type IssueRow = typeof issues.$inferSelect;
export type IssueInsert = typeof issues.$inferInsert;
export type IssueRevisionRow = typeof issueRevisions.$inferSelect;
export type IssueRevisionInsert = typeof issueRevisions.$inferInsert;
/**
 * PostHog event-level data (pageviews, autocapture, pageleave, web_vitals, etc.).
 * Stores all event details not already covered by monitoring (session/recording summary).
 * One row per event; deduplicated by posthog_event_id.
 */
export const posthogEvents = pgTable(
  "posthog_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    posthogEventId: text("posthog_event_id").notNull(),
    eventName: text("event_name").notNull(),
    distinctId: text("distinct_id"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    url: text("url"),
    elementTag: text("element_tag"),
    elementText: text("element_text"),
    sessionId: text("session_id"),
    properties: jsonb("properties"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("posthog_events_posthog_event_id_idx").on(t.posthogEventId)]
);

/**
 * Emails to notify when a new issue is detected. Add/remove from Integration page.
 * Scoped by userId (Clerk) so each user has their own list.
 */
export const developerNotificationEmails = pgTable(
  "developer_notification_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"), // Clerk user id; null = legacy (pre–per-user) row
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("developer_notification_emails_user_email_idx").on(t.userId, t.email)]
);

export type DeveloperNotificationEmailRow = typeof developerNotificationEmails.$inferSelect;
export type DeveloperNotificationEmailInsert = typeof developerNotificationEmails.$inferInsert;

/**
 * Slack webhook URLs for issue notifications. Add/remove from Integration page.
 * Scoped by userId so each user has their own list.
 */
export const developerSlackWebhooks = pgTable(
  "developer_slack_webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    webhookUrl: text("webhook_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("developer_slack_webhooks_user_url_idx").on(t.userId, t.webhookUrl)]
);

export type DeveloperSlackWebhookRow = typeof developerSlackWebhooks.$inferSelect;
export type DeveloperSlackWebhookInsert = typeof developerSlackWebhooks.$inferInsert;

/**
 * PostHog Personal API key per user. Add/remove from Integration page. One key per user.
 * Used for session recordings, events, and analytics when set; otherwise falls back to NEXT_POST_HOG_KEY env.
 */
export const developerPosthogKeys = pgTable(
  "developer_posthog_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().unique(),
    apiKey: text("api_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

export type DeveloperPosthogKeyRow = typeof developerPosthogKeys.$inferSelect;
export type DeveloperPosthogKeyInsert = typeof developerPosthogKeys.$inferInsert;

export type LogRow = typeof logs.$inferSelect;
export type LogInsert = typeof logs.$inferInsert;
export type PosthogEventRow = typeof posthogEvents.$inferSelect;
export type PosthogEventInsert = typeof posthogEvents.$inferInsert;
