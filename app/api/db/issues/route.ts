import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { issues as issuesTable } from "@/lib/db/schema";
import { VectorSyncService } from "@/lib/vector-sync.service";
import { eq } from "drizzle-orm";

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
    return Response.json({ ok: true });
  } catch (e) {
    console.error("POST /api/db/issues error:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
