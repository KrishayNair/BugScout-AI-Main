import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { developerNotificationEmails } from "@/lib/db/schema";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({ emails: [] }, { status: 200 });
  }
  try {
    const rows = await db
      .select()
      .from(developerNotificationEmails)
      .where(eq(developerNotificationEmails.userId, userId));
    return Response.json({
      emails: rows.map((r) => ({ id: r.id, email: r.email, createdAt: r.createdAt })),
    });
  } catch (e) {
    console.error("GET /api/notifications/emails error:", e);
    return Response.json({ emails: [] }, { status: 200 });
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !EMAIL_REGEX.test(email)) {
      return Response.json({ ok: false, error: "Valid email required" }, { status: 400 });
    }
    await db
      .insert(developerNotificationEmails)
      .values({ userId, email })
      .onConflictDoNothing({
        target: [developerNotificationEmails.userId, developerNotificationEmails.email],
      });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("POST /api/notifications/emails error:", e);
    return Response.json({ ok: false, error: "Failed to add email" }, { status: 500 });
  }
}
