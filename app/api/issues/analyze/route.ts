import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logs as logsTable } from "@/lib/db/schema";
import { getCodebaseMapForLLM } from "@/lib/codebase-map";
import type { MonitoredIssue } from "@/lib/issues-types";
import { getPostHogIssueCategoriesForLLM } from "@/lib/posthog-issue-categories";
import { desc } from "drizzle-orm";

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

/** Per-recording event details from PostHog ($exception, $rageclick, $dead_click). */
export type SessionEventDetail = {
  event: string;
  timestamp?: string;
  message?: string;
  type?: string;
  url?: string;
  element?: string;
  selector?: string;
};

type RequestBody = {
  recordings: RecordingSummary[];
  pageEvents?: PageEventSummary[];
  /** Detailed events per recording (exceptions, rage/dead clicks with message, url, element). */
  sessionEvents?: Record<string, SessionEventDetail[]>;
};

function buildSessionSummary(
  recordings: RecordingSummary[],
  pageEvents?: PageEventSummary[],
  sessionEvents?: Record<string, SessionEventDetail[]>
): string {
  const recLines = recordings.map((r) => {
    const parts = [
      `Session ID: ${r.recordingId}`,
      r.startTime ? `first event time: ${r.startTime}` : null,
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
  let out =
    "Consider ALL events below for potential risks and issues (exceptions, rage/dead clicks, repeated errors, UX friction, patterns). Create an issue for each session that has any such risk.\n\n";
  out += "Session recordings (Session ID + counts + time):\n" + recLines.join("\n");

  if (sessionEvents && Object.keys(sessionEvents).length > 0) {
    out += "\n\nDetailed events per Session ID (exceptions, rage clicks, dead clicks) — use these to write accurate titles and descriptions. Include Session ID and time faced in each issue:\n";
    for (const [recId, events] of Object.entries(sessionEvents)) {
      if (!events?.length) continue;
      const times = events.map((e) => e.timestamp).filter(Boolean);
      out += `\nSession ID: ${recId}${times.length ? `. Times faced: ${times.join(", ")}` : ""}\n`;
      for (const e of events) {
        const parts = [e.event];
        if (e.message) parts.push(`message: ${e.message}`);
        if (e.type) parts.push(`type: ${e.type}`);
        if (e.url) parts.push(`url: ${e.url}`);
        if (e.element) parts.push(`element: ${e.element}`);
        if (e.selector) parts.push(`selector: ${e.selector}`);
        if (e.timestamp) parts.push(`at ${e.timestamp}`);
        out += `  - ${parts.join(" | ")}\n`;
      }
    }
  }

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
    const sessionEvents = body.sessionEvents && typeof body.sessionEvents === "object" ? body.sessionEvents : undefined;

    if (recordings.length === 0) {
      return Response.json({ issues: [], agent: "issue-monitoring" });
    }

    const sessionSummary = buildSessionSummary(recordings, pageEvents, sessionEvents);
    const posthogCategories = getPostHogIssueCategoriesForLLM();
    const codebaseMap = getCodebaseMapForLLM();

    let logsContext = "";
    if (process.env.DATABASE_URL) {
      try {
        const recentLogs = await db
          .select({
            title: logsTable.title,
            description: logsTable.description,
            severity: logsTable.severity,
            suggestedFix: logsTable.suggestedFix,
          })
          .from(logsTable)
          .orderBy(desc(logsTable.createdAt))
          .limit(15);
        if (recentLogs.length > 0) {
          logsContext =
            "\n\nRecent resolved/similar issues from logs (for context; consider when describing severity or similar patterns):\n" +
            recentLogs
              .map(
                (l) =>
                  `- ${l.title} (${l.severity}): ${l.description.slice(0, 120)}... | fix: ${(l.suggestedFix ?? "").slice(0, 80)}...`
              )
              .join("\n");
        }
      } catch {
        // non-fatal
      }
    }

    const systemPrompt = `You are an Issue Monitoring Agent. You analyze PostHog live session data (session replay summaries and page events) and map each problem to PostHog's issue taxonomy. You do NOT suggest fixes — you only classify and pinpoint code location for a downstream Solution Agent.

Steps:
1. Use ALL provided data: every session's event set (exceptions, rage/dead clicks, counts, page events). Look for any possible risks or issues — not only obvious errors but patterns, repeated failures, UX friction. Create an issue for each session/recording that has any such risk.
2. For each session with issues, pick exactly one PostHog category and issue type from the JSON below (use category id and issueTypes[].id). Prefer "js-frontend-errors" when exception details are present; use rage/dead-click types when those events are present.
3. Assign a severity tag: "Critical" (blocking, data loss, security), "High" (major UX/reliability, repeated rage/dead clicks), "Medium" (noticeable but workaround exists), "Low" (minor, cosmetic). Base it on impact and actual event details.
4. Write a short title and a 2–3 sentence description. Do NOT include "Session ID" or "Time faced" in the description (they are shown separately in the UI). Do not list raw timestamps; summarize instead (e.g. "5 rage clicks in quick succession on the courses section"). Describe what happened, where (URL/element), and the main signal (exception message, rage/dead clicks). Be specific and concise.
5. Using the codebase map, identify the most likely file(s) where the bug or UX issue originates (codeLocation: file path). Use the event URL/path and element/selector when present.
6. If you can infer a specific component or area from the event element/selector or URL, add a brief codeSnippetHint. Do not invent code — only hint based on the provided event data.

PostHog issue categories (map each issue to one category and one issueType id):
${posthogCategories}
${logsContext}

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
