import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { issues as issuesTable } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

type Params = { params: Promise<{ recordingId: string }> };

export async function PATCH(
  request: NextRequest,
  { params }: Params
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false }, { status: 503 });
  }
  try {
    const { recordingId } = await params;
    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.status === "string") updates.status = body.status;
    if (typeof body.approved === "boolean") updates.approved = body.approved;
    if (typeof body.approvedRating === "number") updates.approvedRating = body.approvedRating;
    if (body.approvedAt !== undefined) updates.approvedAt = body.approvedAt ? new Date(body.approvedAt) : null;
    if (typeof body.suggestedFix === "string") updates.suggestedFix = body.suggestedFix;

    await db
      .update(issuesTable)
      .set(updates as Record<string, unknown>)
      .where(and(eq(issuesTable.recordingId, recordingId), eq(issuesTable.userId, userId)));
    return Response.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/db/issues/[recordingId] error:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
