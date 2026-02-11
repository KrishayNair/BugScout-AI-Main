/**
 * Send new-issue notifications to Slack via Incoming Webhook.
 * Set SLACK_WEBHOOK_URL in .env.local (create a webhook in Slack: App → Incoming Webhooks → Add to workspace).
 */

export type IssueForSlack = {
  title: string;
  description: string;
  severity: string;
  recordingId?: string;
};

const severityEmoji: Record<string, string> = {
  Critical: "🔴",
  High: "🟠",
  Medium: "🟡",
  Low: "⚪",
};

export async function sendNewIssueAlertToSlack(
  webhookUrl: string,
  issues: IssueForSlack[]
): Promise<{ ok: boolean; error?: string }> {
  if (!webhookUrl.trim()) {
    return { ok: false, error: "Slack webhook URL not set" };
  }

  const text =
    issues.length === 1
      ? `*[bugScout]* New issue: ${issues[0].title}`
      : `*[bugScout]* ${issues.length} new issues detected`;

  const blocks: unknown[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text },
    },
    { type: "divider" },
  ];

  for (const issue of issues) {
    const emoji = severityEmoji[issue.severity] ?? "⚪";
    blocks.push({
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Title*\n${escapeSlack(issue.title)}` },
        { type: "mrkdwn", text: `*Severity*\n${emoji} ${escapeSlack(issue.severity)}` },
        { type: "mrkdwn", text: `*Description*\n${escapeSlack(issue.description.slice(0, 500))}${issue.description.length > 500 ? "…" : ""}` },
      ],
    });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "View and manage issues in your bugScout dashboard." }],
  });

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, blocks }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[Slack] Webhook error:", res.status, err);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    console.error("[Slack] send failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

function escapeSlack(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
