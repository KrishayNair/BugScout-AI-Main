import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { developerNotificationEmails, developerSlackWebhooks, issues as issuesTable } from "@/lib/db/schema";
import { sendLatestIssueSummary } from "@/lib/email";
import { sendNewIssueAlertToSlack } from "@/lib/slack";

/**
 * POST: Send the user's latest issue (by updatedAt) to all configured notification emails and Slack.
 * Called when the Issues page is loaded/reloaded.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }

  try {
    const [latestIssue] = await db
      .select()
      .from(issuesTable)
      .where(eq(issuesTable.userId, userId))
      .orderBy(desc(issuesTable.updatedAt))
      .limit(1);

    if (!latestIssue) {
      return Response.json({ ok: true, sent: false, message: "No issues to send" });
    }

    const payload = {
      title: latestIssue.title,
      description: latestIssue.description,
      severity: latestIssue.severity,
      recordingId: latestIssue.recordingId,
      codeLocation: latestIssue.codeLocation ?? undefined,
      startUrl: latestIssue.startUrl ?? undefined,
      suggestedFix: latestIssue.suggestedFix ?? undefined,
    };

    let emailSent = false;
    const recipients = await db
      .select()
      .from(developerNotificationEmails)
      .where(eq(developerNotificationEmails.userId, userId));
    if (recipients.length > 0) {
      await Promise.all(
        recipients.map(async (row) => {
          const r = await sendLatestIssueSummary(row.email, payload);
          if (!r.ok) console.error("[send-latest-issue] Email to", row.email, "failed:", r.error);
          else emailSent = true;
        })
      );
    }

    let slackSent = false;
    const slackWebhooksList: string[] = [];
    const rows = await db
      .select({ webhookUrl: developerSlackWebhooks.webhookUrl })
      .from(developerSlackWebhooks)
      .where(eq(developerSlackWebhooks.userId, userId));
    slackWebhooksList.push(...rows.map((r) => r.webhookUrl));
    const envWebhook = process.env.SLACK_WEBHOOK_URL?.trim();
    if (envWebhook && !slackWebhooksList.includes(envWebhook)) slackWebhooksList.push(envWebhook);
    for (const webhookUrl of slackWebhooksList) {
      const slackResult = await sendNewIssueAlertToSlack(webhookUrl, [payload]);
      if (slackResult.ok) slackSent = true;
      else console.error("[send-latest-issue] Slack failed:", slackResult.error);
    }

    return Response.json({ ok: true, sent: emailSent || slackSent });
  } catch (e) {
    console.error("POST /api/notifications/send-latest-issue error:", e);
    return Response.json({ ok: false, error: "Failed to send latest issue" }, { status: 500 });
  }
}
