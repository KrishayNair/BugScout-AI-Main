import { NextRequest } from "next/server";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/** Code layout for campus2career (Learnify-Placement-Assist) – used by LLM to suggest accurate file paths */
const CAMPUS2CAREER_CODE_LAYOUT = `
campus2career (Learnify-Placement-Assist) code layout – Next.js App Router, TypeScript, Tailwind, Drizzle ORM, Clerk:
- src/app: layout.tsx, page.tsx, globals.css, loading.tsx, providers.jsx
- src/app/api: analyze, courses, dsa/problems, interview (analyze, answer, question, questions, report, setup), jobs, leaderboard, points, profile/[id], resume (analyze, generate), transcribe/route.ts
- src/app/dashboard: blog/[slug], courses (dsa, graphs, sorting, trees, [id]), jobs, leaderboard, mentoring ([roomId]), placements, profile/[id], resume-builder, resume-review
- src/components: ui (button, card, dialog, input, select, table, tabs, toast, etc.), mentoring/video-call, posthog, code-playground, graph-algorithms, graph-visualizer, sidebar, theory-section, latest-blogs
- src/lib: data (dsa-theory, graph-theory, sorting-theory), db (migrations, schema: sessions, users, gemini, points), types, utils (openai, middleware)
- src/middleware.ts
- scripts: migrate-sql.js, migrate.ts, run-sql.ts
- db/migrations
`;

type RecordingSummary = {
  recordingId: string;
  consoleErrorCount: number;
  clickCount: number;
  rageClickCount?: number;
  deadClickCount?: number;
  durationSeconds?: number;
  startUrl?: string;
  startTime?: string;
};

type IssueOutput = {
  recordingId: string;
  title: string;
  description: string;
  suggestedFix?: string;
  codeLocation?: string;
};

export async function POST(request: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return Response.json(
      { issues: [], message: "OPENAI_API_KEY is not set" },
      { status: 200 }
    );
  }

  try {
    const body = await request.json();
    const recordings = Array.isArray(body.recordings) ? body.recordings as RecordingSummary[] : [];

    if (recordings.length === 0) {
      return Response.json({ issues: [] });
    }

    const summary = recordings
      .map((r) => {
        const parts = [
          `${r.consoleErrorCount} console error(s)`,
          `${r.clickCount} clicks`,
          (r.rageClickCount ?? 0) > 0 ? `${r.rageClickCount} rage click(s)` : null,
          (r.deadClickCount ?? 0) > 0 ? `${r.deadClickCount} dead click(s)` : null,
          `duration ${r.durationSeconds ?? "?"}s`,
          r.startUrl ? `start URL: ${r.startUrl}` : null,
        ].filter(Boolean);
        return `- Recording ${r.recordingId}: ${parts.join(", ")}`;
      })
      .join("\n");

    const systemPrompt = `You are a bug-tracking assistant. Given session recordings with issues (console errors, rage clicks, dead clicks), produce one issue per recording.
Rage clicks = repeated clicks on same element (user frustration). Dead clicks = clicks with no effect (broken/unresponsive UI).
${CAMPUS2CAREER_CODE_LAYOUT}
For each recording output JSON: { "recordingId", "title", "description", "suggestedFix", "codeLocation" }.
- title: short user-facing issue title (e.g. "Rage clicks on submit button").
- description: 2–3 sentences on what went wrong and how to investigate via session replay.
- suggestedFix: concrete steps or code changes to fix (e.g. add loading state, check onClick handler).
- codeLocation: likely file paths from the code layout above (e.g. "src/app/dashboard/resume-builder/page.tsx" or "src/components/ui/button.tsx"). Infer from startUrl and issue type.
Output valid JSON only: { "issues": [ { "recordingId": "id", "title": "...", "description": "...", "suggestedFix": "...", "codeLocation": "..." }, ... ] }. Match order and recordingId. No markdown.`;

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
          {
            role: "user",
            content: `Session recordings with issues:\n${summary}`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1200,
      }),
    });

    if (!res.ok) {
      return Response.json({ issues: [] }, { status: 200 });
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return Response.json({ issues: [] });

    let parsed: { issues?: IssueOutput[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ issues: [] });
    }

    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter(
          (i): i is IssueOutput =>
            i != null &&
            typeof i.recordingId === "string" &&
            typeof i.title === "string" &&
            typeof i.description === "string"
        )
      : [];
    return Response.json({ issues });
  } catch {
    return Response.json({ issues: [] });
  }
}
