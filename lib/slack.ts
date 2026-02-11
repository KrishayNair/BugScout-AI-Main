/**
 * Send new-issue notifications to Slack via Incoming Webhook.
 * Set SLACK_WEBHOOK_URL in .env.local (create a webhook in Slack: App → Incoming Webhooks → Add to workspace).
 */

export type IssueForSlack = {
  title: string;
  description: string;
  severity: string;
  recordingId?: string;
  codeLocation?: string;
  suggestedFix?: string;
  startUrl?: string;
};

const MAX_SLACK_ISSUES_PER_MESSAGE = 10;

const severityEmoji: Record<string, string> = {
  Critical: "🔴",
  High: "🟠",
  Medium: "🟡",
  Low: "⚪",
};

function truncateText(value: string | undefined, max = 220): string {
  if (!value) return "n/a";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export async function sendNewIssueAlertToSlack(
  webhookUrl: string,
  issues: IssueForSlack[]
): Promise<{ ok: boolean; error?: string }> {
  if (!webhookUrl.trim()) {
    return { ok: false, error: "Slack webhook URL not set" };
  }

  const selectedIssues = issues.slice(0, MAX_SLACK_ISSUES_PER_MESSAGE);
  const overflowCount = Math.max(0, issues.length - selectedIssues.length);
  const title =
    issues.length === 1
      ? "1 new issue detected by BugScout"
      : `${issues.length} new issues detected by BugScout`;

  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: { type: "plain_text", text: title, emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Issue alerts from session replay analysis.",
      },
    },
    { type: "divider" },
  ];

  for (const issue of selectedIssues) {
    const emoji = severityEmoji[issue.severity] ?? "⚪";
    const startUrl = truncateText(issue.startUrl, 140);
    const description = truncateText(issue.description, 260);
    const suggestedFix = truncateText(issue.suggestedFix, 220);
    const codeLocation = truncateText(issue.codeLocation, 120);

    const lines = [
      `*${escapeSlack(truncateText(issue.title, 100))}*`,
      `*Recording:* \`${escapeSlack(issue.recordingId ?? "n/a")}\``,
      `*Severity:* ${emoji} ${escapeSlack(issue.severity)}`,
      `*URL:* ${escapeSlack(startUrl)}`,
      `*Description:* ${escapeSlack(description)}`,
      `*Suggested fix:* ${escapeSlack(suggestedFix)}`,
      `*Likely code location:* \`${escapeSlack(codeLocation)}\``,
    ];
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n") },
    });
    blocks.push({ type: "divider" });
  }

  if (overflowCount > 0) {
    blocks.push({
      type: "context",
      elements: [
        { type: "mrkdwn", text: `…and ${overflowCount} more new issue(s) not shown in this message.` },
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
      body: JSON.stringify({ text: title, blocks }),
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
