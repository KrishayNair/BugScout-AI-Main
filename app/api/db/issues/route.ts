import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { developerNotificationEmails, issues as issuesTable } from "@/lib/db/schema";
import { sendNewIssueAlert } from "@/lib/email";
import { VectorSyncService } from "@/lib/vector-sync.service";
import { eq, inArray } from "drizzle-orm";

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return Response.json({ issues: [] }, { status: 200 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const recordingId = searchParams.get("recordingId");
    const list = recordingId
      ? await db.select().from(issuesTable).where(eq(issuesTable.recordingId, recordingId))
      : await db.select().from(issuesTable);
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
    const existing = await db
      .select({ recordingId: issuesTable.recordingId })
      .from(issuesTable)
      .where(inArray(issuesTable.recordingId, recordingIds));
    const existingSet = new Set(existing.map((r) => r.recordingId));
    const newIssues = list.filter((i) => !existingSet.has(i.recordingId));

    for (const i of list) {
      await db
        .insert(issuesTable)
        .values({
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
          target: issuesTable.recordingId,
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

    if (newIssues.length > 0) {
      const recipients = await db.select().from(developerNotificationEmails);
      if (recipients.length === 0) {
        console.warn("[POST /api/db/issues] New issues detected but no notification emails configured. Add emails in Integration settings.");
      } else {
        console.info("[POST /api/db/issues] Sending new-issue alerts to", recipients.length, "recipient(s).");
        for (const row of recipients) {
          sendNewIssueAlert(
            row.email,
            newIssues.map((i) => ({
              title: i.title,
              description: i.description,
              severity: i.severity,
              recordingId: i.recordingId,
            }))
          ).then((r) => {
            if (!r.ok) console.error("[POST /api/db/issues] Email to", row.email, "failed:", r.error);
          }).catch((err) => console.error("[POST /api/db/issues] Email to", row.email, "failed:", err));
        }
      }
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("POST /api/db/issues error:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
