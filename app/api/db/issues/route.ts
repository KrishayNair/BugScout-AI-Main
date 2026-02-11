import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { developerNotificationEmails, developerSlackWebhooks, issues as issuesTable } from "@/lib/db/schema";
import { sendLatestIssueSummary } from "@/lib/email";
import { sendNewIssueAlertToSlack } from "@/lib/slack";
import { VectorSyncService } from "@/lib/vector-sync.service";
import { and, eq, inArray, isNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({ issues: [] }, { status: 200 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const recordingId = searchParams.get("recordingId");
    const baseWhere = eq(issuesTable.userId, userId);
    const list = recordingId
      ? await db.select().from(issuesTable).where(and(baseWhere, eq(issuesTable.recordingId, recordingId)))
      : await db.select().from(issuesTable).where(baseWhere);
    return Response.json({ issues: list });
  } catch (e) {
    console.error("GET /api/db/issues error:", e);
    return Response.json({ issues: [] }, { status: 200 });
  }
}

type IssueUpsert = {
  recordingId: string;
  posthogCategoryId: string;
  posthogIssueTypeId: string;
  title: string;
  description: string;
  severity: string;
  codeLocation: string;
  codeSnippetHint?: string;
  startUrl?: string;
  suggestedFix?: string;
};

export async function POST(request: NextRequest) {
  const { userId: authUserId } = await auth();
  // When called from app (has auth): use current user. When called from sync/cron (no auth): use env owner.
  const userId = authUserId ?? process.env.BUGSCOUT_DEFAULT_USER_ID ?? null;

  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false }, { status: 503 });
  }
  try {
    const body = await request.json();
    const list = Array.isArray(body.issues) ? (body.issues as IssueUpsert[]) : [];
    if (list.length === 0) {
      return Response.json({ ok: true });
    }

    const recordingIds = list.map((i) => i.recordingId);
    const userCondition = userId != null ? eq(issuesTable.userId, userId) : isNull(issuesTable.userId);
    const existing = await db
      .select({ recordingId: issuesTable.recordingId })
      .from(issuesTable)
      .where(and(userCondition, inArray(issuesTable.recordingId, recordingIds)));
    const existingSet = new Set(existing.map((r) => r.recordingId));
    const newIssues = list.filter((i) => !existingSet.has(i.recordingId));

    for (const i of list) {
      await db
        .insert(issuesTable)
        .values({
          userId,
          recordingId: i.recordingId,
          posthogCategoryId: i.posthogCategoryId,
          posthogIssueTypeId: i.posthogIssueTypeId,
          title: i.title,
          description: i.description,
          severity: i.severity,
          codeLocation: i.codeLocation,
          codeSnippetHint: i.codeSnippetHint ?? null,
          startUrl: i.startUrl ?? null,
          suggestedFix: i.suggestedFix ?? null,
        })
        .onConflictDoUpdate({
          target: [issuesTable.userId, issuesTable.recordingId],
          set: {
            posthogCategoryId: i.posthogCategoryId,
            posthogIssueTypeId: i.posthogIssueTypeId,
            title: i.title,
            description: i.description,
            severity: i.severity,
            codeLocation: i.codeLocation,
            codeSnippetHint: i.codeSnippetHint ?? null,
            startUrl: i.startUrl ?? null,
            suggestedFix: i.suggestedFix ?? null,
            updatedAt: new Date(),
          },
        });
    }
    await VectorSyncService.syncIssues(list).catch((err) => {
      console.error("[POST /api/db/issues] Chroma sync failed:", err);
    });

    // Send the latest (most recent) new issue to email and Slack
    if (newIssues.length > 0) {
      const latestNew = newIssues[newIssues.length - 1];
      const latestPayload = {
        title: latestNew.title,
        description: latestNew.description,
        severity: latestNew.severity,
        recordingId: latestNew.recordingId,
        codeLocation: latestNew.codeLocation ?? undefined,
        startUrl: latestNew.startUrl ?? undefined,
        suggestedFix: latestNew.suggestedFix ?? undefined,
      };

      if (userId) {
        const recipients = await db
          .select()
          .from(developerNotificationEmails)
          .where(eq(developerNotificationEmails.userId, userId));
        if (recipients.length === 0) {
          console.warn("[POST /api/db/issues] New issues detected but no notification emails configured. Add emails in Integration settings.");
        } else {
          console.info("[POST /api/db/issues] Sending latest-issue email to", recipients.length, "recipient(s).");
          await Promise.all(
            recipients.map(async (row) => {
              const r = await sendLatestIssueSummary(row.email, latestPayload);
              if (!r.ok) console.error("[POST /api/db/issues] Email to", row.email, "failed:", r.error);
            })
          );
        }
      }

      const slackWebhooksList: string[] = [];
      if (userId) {
        const rows = await db
          .select({ webhookUrl: developerSlackWebhooks.webhookUrl })
          .from(developerSlackWebhooks)
          .where(eq(developerSlackWebhooks.userId, userId));
        slackWebhooksList.push(...rows.map((r) => r.webhookUrl));
      }
      const envWebhook = process.env.SLACK_WEBHOOK_URL?.trim();
      if (envWebhook && !slackWebhooksList.includes(envWebhook)) slackWebhooksList.push(envWebhook);
      for (const webhookUrl of slackWebhooksList) {
        const slackResult = await sendNewIssueAlertToSlack(webhookUrl, [latestPayload]);
        if (!slackResult.ok) console.error("[POST /api/db/issues] Slack to webhook failed:", slackResult.error);
      }
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("POST /api/db/issues error:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
