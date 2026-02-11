import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { developerSlackWebhooks } from "@/lib/db/schema";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false }, { status: 503 });
  }
  try {
    const { id } = await params;
    await db
      .delete(developerSlackWebhooks)
      .where(and(eq(developerSlackWebhooks.id, id), eq(developerSlackWebhooks.userId, userId)));
    return Response.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/notifications/slack-webhooks/[id] error:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
