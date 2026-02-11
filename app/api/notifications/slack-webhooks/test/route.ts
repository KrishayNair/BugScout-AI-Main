import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

const SLACK_WEBHOOK_PREFIX = "https://hooks.slack.com/";

function isValidWebhookUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.startsWith(SLACK_WEBHOOK_PREFIX) && trimmed.length > SLACK_WEBHOOK_PREFIX.length;
}

export async function POST(request: NextRequest) {
  await auth();
  try {
    const body = await request.json();
    const webhookUrl = typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : "";
    if (!webhookUrl || !isValidWebhookUrl(webhookUrl)) {
      return Response.json(
        { ok: false, error: "Valid Slack webhook URL required" },
        { status: 400 }
      );
    }
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Hello from bugScout — this is a test. Issue notifications will be sent here.",
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return Response.json({ ok: false, error: err || `Slack returned ${res.status}` }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error("POST /api/notifications/slack-webhooks/test error:", e);
    return Response.json({ ok: false, error: "Failed to send test message" }, { status: 500 });
  }
}
