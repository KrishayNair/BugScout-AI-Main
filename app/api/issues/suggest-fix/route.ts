import { NextRequest } from "next/server";
import { getCodebaseMapForLLM } from "@/lib/codebase-map";
import { db } from "@/lib/db";
import { logs as logsTable, type LogRow } from "@/lib/db/schema";
import type { MonitoredIssue, SuggestedFix } from "@/lib/issues-types";
import { desc } from "drizzle-orm";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const LOGS_LIMIT = 25;

export type { SuggestedFix };

type RequestBody = {
  issues: MonitoredIssue[];
  revisionInstructions?: string;
  previousSuggestedFix?: string;
};

export async function POST(request: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return Response.json(
      { suggestedFixes: [], message: "OPENAI_API_KEY is not set" },
      { status: 200 }
    );
  }

  try {
    const body = (await request.json()) as RequestBody;
    const issues = Array.isArray(body.issues) ? body.issues : [];
    const revisionInstructions = typeof body.revisionInstructions === "string" ? body.revisionInstructions.trim() : undefined;
    const previousSuggestedFix = typeof body.previousSuggestedFix === "string" ? body.previousSuggestedFix : undefined;
    const isRevision = Boolean(revisionInstructions && previousSuggestedFix && issues.length === 1);

    if (issues.length === 0) {
      return Response.json({ suggestedFixes: [], agent: "solution" });
    }

    let logsContext = "";
    if (process.env.DATABASE_URL) {
      try {
        const logsToUse = await db
          .select()
          .from(logsTable)
          .orderBy(desc(logsTable.createdAt))
          .limit(LOGS_LIMIT);
        if (logsToUse.length > 0) {
          logsContext =
            "\n\nPast solutions from the knowledge base (use these to inform your suggestions; when your suggestion aligns with a past solution that had a high developer rating, set agentConfidenceScore closer to 1.0):\n" +
            logsToUse
              .map(
                (l: LogRow) =>
                  `- title: ${l.title}\n  description: ${l.description}\n  severity: ${l.severity}\n  suggestedFix: ${l.suggestedFix}\n  developerRating: ${l.developerRating ?? "—"}`
              )
              .join("\n");
        }
      } catch (e) {
        console.error("suggest-fix: fetch logs error", e);
      }
    }

    const codebaseMap = getCodebaseMapForLLM();
    const issuesBlock = issues
      .map(
        (i) =>
          `- recordingId: ${i.recordingId}
  category: ${i.posthogCategoryId} / ${i.posthogIssueTypeId}
  title: ${i.title}
  description: ${i.description}
  codeLocation: ${i.codeLocation}
  codeSnippetHint: ${i.codeSnippetHint ?? "(none)"}
  startUrl: ${i.startUrl ?? "(none)"}`
      )
      .join("\n\n");

    const systemPrompt = `You are a Solution Agent. You receive the output from an Issue Monitoring Agent: a list of issues (each with PostHog category, title, description, code location, and optional snippet hint). Your job is to suggest concrete fixes for each issue.

Use the codebase map only to align file paths and component names. Do not invent file contents. Suggest:
1. suggestedFix: step-by-step fix (e.g. add loading state, fix onClick handler, add error boundary, improve form validation). Be concrete and actionable.
2. Optionally codeEdits: array of { file, description, snippet } where snippet is a short code change (e.g. a few lines to add or change). Keep snippets minimal and accurate to the codebase map.
3. agentConfidenceScore: number from 0 to 1. Set higher (e.g. 0.8–1.0) when your suggestion is strongly supported by a similar past solution in the knowledge base with a high developer rating; set lower when you are inferring without a close match.
${logsContext}

${codebaseMap}

Output valid JSON only, no markdown:
{
  "suggestedFixes": [
    {
      "recordingId": "<id>",
      "title": "<same as input>",
      "suggestedFix": "<multiline step-by-step fix>",
      "codeLocation": "<same file path>",
      "codeEdits": [
        { "file": "<path>", "description": "<what to do>", "snippet": "<few lines of code or diff-style change>" }
      ],
      "agentConfidenceScore": 0.0
    }
  ]
}
Include one entry per input issue. codeEdits can be empty array if you only suggest high-level steps. agentConfidenceScore must be a number between 0 and 1.`;

    const userContent = isRevision
      ? `The developer requested a revision for this issue.

Previous suggested fix:
${previousSuggestedFix}

Developer revision instructions:
${revisionInstructions}

Issue context:
${issuesBlock}

Output a revised suggested fix in the same JSON format (suggestedFixes array with one object for recordingId ${issues[0].recordingId}).`
      : `Issues from Issue Monitoring Agent (fix each):\n\n${issuesBlock}`;

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
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2500,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenAI solution agent error:", res.status, err);
      return Response.json({ suggestedFixes: [], agent: "solution" }, { status: 200 });
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return Response.json({ suggestedFixes: [], agent: "solution" });

    let parsed: { suggestedFixes?: SuggestedFix[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ suggestedFixes: [], agent: "solution" });
    }

    const suggestedFixes = Array.isArray(parsed.suggestedFixes)
      ? parsed.suggestedFixes.filter(
          (s): s is SuggestedFix =>
            s != null &&
            typeof s.recordingId === "string" &&
            typeof s.title === "string" &&
            typeof s.suggestedFix === "string" &&
            typeof s.codeLocation === "string"
        )
      : [];

    if (process.env.DATABASE_URL && suggestedFixes.length > 0) {
      try {
        for (const fix of suggestedFixes) {
          const score =
            typeof fix.agentConfidenceScore === "number" && fix.agentConfidenceScore >= 0 && fix.agentConfidenceScore <= 1
              ? fix.agentConfidenceScore
              : null;
          if (score == null) continue;
          const issue = issues.find((i) => i.recordingId === fix.recordingId);
          if (!issue) continue;
          await db.insert(logsTable).values({
            recordingId: fix.recordingId,
            title: fix.title,
            description: issue.description,
            severity: issue.severity,
            suggestedFix: fix.suggestedFix,
            agentConfidenceScore: String(score),
          });
        }
      } catch (e) {
        console.error("suggest-fix: persist logs error", e);
      }
    }

    return Response.json({ suggestedFixes, agent: "solution" });
  } catch (e) {
    console.error("Solution agent error:", e);
    return Response.json({ suggestedFixes: [], agent: "solution" });
  }
}
