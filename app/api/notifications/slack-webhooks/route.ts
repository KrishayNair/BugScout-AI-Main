import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { developerSlackWebhooks } from "@/lib/db/schema";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({ webhooks: [] }, { status: 200 });
  }
  try {
    const rows = await db
      .select()
      .from(developerSlackWebhooks)
      .where(eq(developerSlackWebhooks.userId, userId));
    return Response.json({
      webhooks: rows.map((r) => ({ id: r.id, webhookUrl: r.webhookUrl, createdAt: r.createdAt })),
    });
  } catch (e) {
    console.error("GET /api/notifications/slack-webhooks error:", e);
    return Response.json({ webhooks: [] }, { status: 200 });
  }
}

const SLACK_WEBHOOK_PREFIX = "https://hooks.slack.com/";

function isValidWebhookUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.startsWith(SLACK_WEBHOOK_PREFIX) && trimmed.length > SLACK_WEBHOOK_PREFIX.length;
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
    const webhookUrl = typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : "";
    if (!webhookUrl || !isValidWebhookUrl(webhookUrl)) {
      return Response.json(
        { ok: false, error: "Valid Slack webhook URL required (https://hooks.slack.com/...)" },
        { status: 400 }
      );
    }
    await db
      .insert(developerSlackWebhooks)
      .values({ userId, webhookUrl })
      .onConflictDoNothing({
        target: [developerSlackWebhooks.userId, developerSlackWebhooks.webhookUrl],
      });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("POST /api/notifications/slack-webhooks error:", e);
    return Response.json({ ok: false, error: "Failed to add webhook" }, { status: 500 });
  }
}
