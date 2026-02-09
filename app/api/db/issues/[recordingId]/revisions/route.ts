import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { issues as issuesTable } from "@/lib/db/schema";
import { issueRevisions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ recordingId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false }, { status: 503 });
  }
  try {
    const { recordingId } = await params;
    const body = await request.json();
    const instruction = typeof body.instruction === "string" ? body.instruction : "";
    const suggestedFixAfter = typeof body.suggestedFixAfter === "string" ? body.suggestedFixAfter : null;

    const [issue] = await db.select().from(issuesTable).where(eq(issuesTable.recordingId, recordingId));
    if (!issue) return Response.json({ ok: false, message: "Issue not found" }, { status: 404 });

    await db.insert(issueRevisions).values({
      issueId: issue.id,
      instruction,
      suggestedFixAfter,
    });

    if (suggestedFixAfter != null) {
      await db
        .update(issuesTable)
        .set({ suggestedFix: suggestedFixAfter, updatedAt: new Date() })
        .where(eq(issuesTable.recordingId, recordingId));
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error("POST /api/db/issues/[recordingId]/revisions error:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
