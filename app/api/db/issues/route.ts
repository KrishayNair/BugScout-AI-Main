import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { developerNotificationEmails, issues as issuesTable } from "@/lib/db/schema";
import { sendNewIssueAlert } from "@/lib/email";
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

    const newIssuePayload = newIssues.map((i) => ({
      title: i.title,
      description: i.description,
      severity: i.severity,
      recordingId: i.recordingId,
    }));

    if (newIssues.length > 0) {
      if (userId) {
        const recipients = await db
          .select()
          .from(developerNotificationEmails)
          .where(eq(developerNotificationEmails.userId, userId));
        if (recipients.length === 0) {
          console.warn("[POST /api/db/issues] New issues detected but no notification emails configured. Add emails in Integration settings.");
        } else {
          console.info("[POST /api/db/issues] Sending new-issue email alerts to", recipients.length, "recipient(s).");
          await Promise.all(
            recipients.map(async (row) => {
              const r = await sendNewIssueAlert(row.email, newIssuePayload);
              if (!r.ok) console.error("[POST /api/db/issues] Email to", row.email, "failed:", r.error);
            })
          );
        }
      }

      const slackWebhook = process.env.SLACK_WEBHOOK_URL?.trim();
      if (slackWebhook) {
        const slackResult = await sendNewIssueAlertToSlack(slackWebhook, newIssuePayload);
        if (slackResult.ok) {
          console.info("[POST /api/db/issues] Slack notification sent.");
        } else {
          console.error("[POST /api/db/issues] Slack notification failed:", slackResult.error);
        }
      }
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("POST /api/db/issues error:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
