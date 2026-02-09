import { NextRequest } from "next/server";
import { getPostHogIssueCategoriesForLLM } from "@/lib/posthog-issue-categories";
import { getCodebaseMapForLLM } from "@/lib/codebase-map";
import type { MonitoredIssue } from "@/lib/issues-types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export type { MonitoredIssue };

/** PostHog session recording summary (live session monitoring data). */
export type RecordingSummary = {
  recordingId: string;
  consoleErrorCount?: number;
  clickCount?: number;
  rageClickCount?: number;
  deadClickCount?: number;
  durationSeconds?: number;
  startUrl?: string;
  startTime?: string;
  /** Optional: page path or full URL where session started */
  startPath?: string;
};

/** Optional page/event payload from PostHog (events during session). */
export type PageEventSummary = {
  event?: string;
  url?: string;
  path?: string;
  timestamp?: string;
  properties?: Record<string, unknown>;
};

type RequestBody = {
  recordings: RecordingSummary[];
  pageEvents?: PageEventSummary[];
};

function buildSessionSummary(recordings: RecordingSummary[], pageEvents?: PageEventSummary[]): string {
  const recLines = recordings.map((r) => {
    const parts = [
      `Recording ${r.recordingId}:`,
      r.consoleErrorCount != null ? `${r.consoleErrorCount} console error(s)` : null,
      r.clickCount != null ? `${r.clickCount} clicks` : null,
      (r.rageClickCount ?? 0) > 0 ? `${r.rageClickCount} rage click(s)` : null,
      (r.deadClickCount ?? 0) > 0 ? `${r.deadClickCount} dead click(s)` : null,
      r.durationSeconds != null ? `duration ${r.durationSeconds}s` : null,
      r.startUrl ? `start URL: ${r.startUrl}` : null,
      r.startPath ? `start path: ${r.startPath}` : null,
    ].filter(Boolean);
    return parts.join(", ");
  });
  let out = "Session recordings:\n" + recLines.join("\n");
  if (pageEvents?.length) {
    out += "\n\nPage/events during session:\n";
    out += pageEvents
      .slice(0, 50)
      .map(
        (e) =>
          `  ${e.event ?? "event"} ${e.url ?? e.path ?? ""} ${e.timestamp ?? ""}`.trim()
      )
      .join("\n");
  }
  return out;
}

export async function POST(request: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return Response.json(
      { issues: [], message: "OPENAI_API_KEY is not set" },
      { status: 200 }
    );
  }

  try {
    const body = (await request.json()) as RequestBody;
    const recordings = Array.isArray(body.recordings) ? body.recordings : [];
    const pageEvents = Array.isArray(body.pageEvents) ? body.pageEvents : undefined;

    if (recordings.length === 0) {
      return Response.json({ issues: [], agent: "issue-monitoring" });
    }

    const sessionSummary = buildSessionSummary(recordings, pageEvents);
    const posthogCategories = getPostHogIssueCategoriesForLLM();
    const codebaseMap = getCodebaseMapForLLM();

    const systemPrompt = `You are an Issue Monitoring Agent. You analyze PostHog live session data (session replay summaries and page events) and map each problem to PostHog's issue taxonomy. You do NOT suggest fixes — you only classify and pinpoint code location for a downstream Solution Agent.

Steps:
1. For each session recording with issues, pick exactly one PostHog category and issue type from the JSON below (use category id and issueTypes[].id).
2. Assign a severity tag: "Critical" (blocking, data loss, security), "High" (major UX/reliability), "Medium" (noticeable but workaround exists), "Low" (minor, cosmetic). Base it on impact and frequency signals (e.g. many rage clicks + errors = Critical; few dead clicks = Medium/Low).
3. Write a short title and 2–3 sentence description of what went wrong (from session replay: rage clicks, dead clicks, console errors, drop-offs, etc.).
4. Using the codebase map, identify the most likely file(s) where the bug or UX issue originates (codeLocation: file path). Prefer exact paths from the map (e.g. src/app/dashboard/resume-builder/page.tsx).
5. If you can infer a specific component or area (e.g. submit button, form handler), add a brief codeSnippetHint: 1–2 lines describing where to look or a minimal code snippet. Do not invent code — only hint based on route/URL and issue type.

PostHog issue categories (map each issue to one category and one issueType id):
${posthogCategories}

${codebaseMap}

Output valid JSON only, no markdown:
{
  "issues": [
    {
      "recordingId": "<id>",
      "posthogCategoryId": "<e.g. ux|errors|product|performance>",
      "posthogIssueTypeId": "<e.g. rage-frustration|dead-click|js-frontend-errors>",
      "severity": "<Critical|High|Medium|Low>",
      "title": "<short user-facing title>",
      "description": "<2-3 sentences>",
      "codeLocation": "<file path from codebase map>",
      "codeSnippetHint": "<optional 1-2 line hint or minimal snippet>",
      "startUrl": "<from recording if useful>"
    }
  ]
}
Match one entry per recording that has issues; omit recordings with no clear issue. severity must be exactly one of: Critical, High, Medium, Low.`;

    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: sessionSummary },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2000,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenAI issue monitoring error:", res.status, err);
      return Response.json({ issues: [], agent: "issue-monitoring" }, { status: 200 });
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return Response.json({ issues: [], agent: "issue-monitoring" });

    let parsed: { issues?: MonitoredIssue[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ issues: [], agent: "issue-monitoring" });
    }

    const VALID_SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter(
          (i): i is MonitoredIssue =>
            i != null &&
            typeof i.recordingId === "string" &&
            typeof i.posthogCategoryId === "string" &&
            typeof i.posthogIssueTypeId === "string" &&
            typeof i.title === "string" &&
            typeof i.description === "string" &&
            typeof i.codeLocation === "string" &&
            VALID_SEVERITIES.includes(i.severity as (typeof VALID_SEVERITIES)[number])
        )
      : [];

    return Response.json({ issues, agent: "issue-monitoring" });
  } catch (e) {
    console.error("Issue monitoring agent error:", e);
    return Response.json({ issues: [], agent: "issue-monitoring" });
  }
}
