/**
 * Send "new issue" notification emails via Resend.
 * Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env.local.
 */

export type IssueForEmail = {
  title: string;
  description: string;
  severity: string;
  recordingId?: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";

export async function sendNewIssueAlert(
  to: string,
  issues: IssueForEmail[]
): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) {
    console.warn("[Email] RESEND_API_KEY or RESEND_FROM_EMAIL not set; skipping issue notification.");
    return { ok: false, error: "Email not configured" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(to).trim())) {
    console.warn("[Email] Invalid recipient address for new-issue alert:", to);
    return { ok: false, error: "Invalid recipient" };
  }
  const toAddress = String(to).trim().toLowerCase();

  const subject =
    issues.length === 1
      ? `[bugScout] New issue: ${issues[0].title}`
      : `[bugScout] ${issues.length} new issues detected`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New issue(s)</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1a1a; max-width: 560px;">
  <h2 style="color: #0066ff;">bugScout – new issue${issues.length > 1 ? "s" : ""} detected</h2>
  <p>${issues.length} new issue${issues.length > 1 ? "s have" : " has"} been added.</p>
  ${issues
    .map(
      (issue) => `
  <div style="margin: 1rem 0; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 8px;">
    <p style="margin: 0 0 0.5rem 0; font-weight: 600;">${escapeHtml(issue.title)}</p>
    <p style="margin: 0 0 0.25rem 0; font-size: 0.875rem;"><strong>Severity:</strong> ${escapeHtml(issue.severity)}</p>
    <p style="margin: 0; font-size: 0.875rem; color: #4b5563;">${escapeHtml(issue.description)}</p>
  </div>
  `
    )
    .join("")}
  <p style="margin-top: 1.5rem; font-size: 0.875rem; color: #6b7280;">View and manage issues in your bugScout dashboard.</p>
</body>
</html>
  `.trim();

  const textBody = [
    `bugScout – new issue${issues.length > 1 ? "s" : ""} detected`,
    "",
    ...issues.map(
      (i) =>
        `Title: ${i.title}\nSeverity: ${i.severity}\nDescription: ${i.description}\n---`
    ),
    "View and manage issues in your bugScout dashboard.",
  ].join("\n");

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [toAddress],
        subject,
        html,
        text: textBody,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[Email] Resend error:", res.status, err);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    console.error("[Email] send failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Send a professional "latest issue summary" email (e.g. when the Issues page is loaded/reloaded).
 * Single-issue format with clear subject and structured body.
 */
export async function sendLatestIssueSummary(
  to: string,
  issue: IssueForEmail & { codeLocation?: string; startUrl?: string; suggestedFix?: string }
): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) {
    console.warn("[Email] RESEND_API_KEY or RESEND_FROM_EMAIL not set; skipping latest-issue summary.");
    return { ok: false, error: "Email not configured" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(to).trim())) {
    return { ok: false, error: "Invalid recipient" };
  }
  const toAddress = String(to).trim().toLowerCase();

  const subject = `[bugScout] Latest issue: ${issue.title}`;
  const severityColor =
    issue.severity === "Critical"
      ? "#dc2626"
      : issue.severity === "High"
        ? "#ea580c"
        : issue.severity === "Medium"
          ? "#d97706"
          : "#6b7280";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Latest issue – bugScout</title></head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 580px; margin: 0 auto;">
  <div style="padding: 24px 0;">
    <h1 style="margin: 0 0 8px 0; font-size: 1.25rem; color: #111827;">bugScout – Latest issue summary</h1>
    <p style="margin: 0; font-size: 0.875rem; color: #6b7280;">Here is your latest issue from the Issues page.</p>
  </div>
  <div style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
    <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px 0; font-weight: 600; font-size: 1rem;">${escapeHtml(issue.title)}</p>
      <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 0.8125rem; font-weight: 500; background: ${severityColor}15; color: ${severityColor};">${escapeHtml(issue.severity)}</span>
    </div>
    <div style="padding: 20px;">
      <p style="margin: 0 0 12px 0; font-size: 0.875rem; color: #374151;"><strong>Description</strong></p>
      <p style="margin: 0 0 16px 0; font-size: 0.875rem; color: #4b5563;">${escapeHtml(issue.description)}</p>
      ${issue.codeLocation ? `<p style="margin: 0 0 4px 0; font-size: 0.8125rem; color: #6b7280;"><strong>Location:</strong> ${escapeHtml(issue.codeLocation)}</p>` : ""}
      ${issue.startUrl ? `<p style="margin: 0 0 12px 0; font-size: 0.8125rem; color: #6b7280;"><strong>URL:</strong> ${escapeHtml(issue.startUrl)}</p>` : ""}
      ${issue.suggestedFix ? `<p style="margin: 12px 0 0 0; font-size: 0.875rem;"><strong>Suggested fix</strong></p><p style="margin: 4px 0 0 0; font-size: 0.875rem; color: #4b5563;">${escapeHtml(issue.suggestedFix)}</p>` : ""}
    </div>
  </div>
  <p style="margin-top: 20px; font-size: 0.8125rem; color: #9ca3af;">View and manage all issues in your bugScout dashboard.</p>
</body>
</html>
  `.trim();

  const textLines = [
    "bugScout – Latest issue summary",
    "",
    "Here is your latest issue from the Issues page.",
    "",
    `Title: ${issue.title}`,
    `Severity: ${issue.severity}`,
    "",
    "Description:",
    issue.description,
    ...(issue.codeLocation ? ["", `Location: ${issue.codeLocation}`] : []),
    ...(issue.startUrl ? [`URL: ${issue.startUrl}`] : []),
    ...(issue.suggestedFix ? ["", "Suggested fix:", issue.suggestedFix] : []),
    "",
    "View and manage all issues in your bugScout dashboard.",
  ];
  const textBody = textLines.join("\n");

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [toAddress],
        subject,
        html,
        text: textBody,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[Email] Resend error (latest-issue):", res.status, err);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    console.error("[Email] sendLatestIssueSummary failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

/**
 * Send a simple "Hello World" test email to verify Resend configuration.
 */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) {
    return { ok: false, error: "Email not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env.local." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(to).trim())) {
    return { ok: false, error: "Invalid email address." };
  }
  const toAddress = String(to).trim().toLowerCase();

  const subject = "[bugScout] Test email";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Test</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1a1a;">
  <h2 style="color: #0066ff;">Hello from bugScout</h2>
  <p>This is a test email. If you received this, your email integration is working.</p>
  <p style="font-size: 0.875rem; color: #6b7280;">You will receive similar emails here when new issues are detected.</p>
</body>
</html>
  `.trim();
  const text = "Hello from bugScout\n\nThis is a test email. If you received this, your email integration is working.\n\nYou will receive similar emails here when new issues are detected.";

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [toAddress],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[Email] Test send error:", res.status, err);
      return { ok: false, error: err || `Resend returned ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[Email] Test send failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}
