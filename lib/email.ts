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

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
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
