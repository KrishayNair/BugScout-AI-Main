import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { developerPosthogKeys } from "@/lib/db/schema";

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 6) + "…" + key.slice(-4);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({ hasKey: false }, { status: 200 });
  }
  try {
    const [row] = await db
      .select({ apiKey: developerPosthogKeys.apiKey })
      .from(developerPosthogKeys)
      .where(eq(developerPosthogKeys.userId, userId))
      .limit(1);
    if (row?.apiKey) {
      return Response.json({ hasKey: true, masked: maskKey(row.apiKey) });
    }
    return Response.json({ hasKey: false }, { status: 200 });
  } catch (e) {
    console.error("GET /api/notifications/posthog-key error:", e);
    return Response.json({ hasKey: false }, { status: 200 });
  }
}

const PHX_PREFIX = "phx_";
const PHC_PREFIX = "phc_";

function looksLikePosthogKey(s: string): boolean {
  const t = s.trim();
  return (t.startsWith(PHX_PREFIX) || t.startsWith(PHC_PREFIX)) && t.length > 10;
}

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
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!apiKey || !looksLikePosthogKey(apiKey)) {
      return Response.json(
        { ok: false, error: "Valid PostHog Personal API key required (e.g. phx_... or phc_...)" },
        { status: 400 }
      );
    }
    await db
      .insert(developerPosthogKeys)
      .values({ userId, apiKey })
      .onConflictDoUpdate({
        target: developerPosthogKeys.userId,
        set: { apiKey, createdAt: new Date() },
      });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("POST /api/notifications/posthog-key error:", e);
    return Response.json({ ok: false, error: "Failed to save key" }, { status: 500 });
  }
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false }, { status: 503 });
  }
  try {
    await db.delete(developerPosthogKeys).where(eq(developerPosthogKeys.userId, userId));
    return Response.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/notifications/posthog-key error:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
