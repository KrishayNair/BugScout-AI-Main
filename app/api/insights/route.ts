import { NextRequest } from "next/server";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(request: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return Response.json(
      { insights: [], message: "OPENAI_API_KEY is not set" },
      { status: 200 }
    );
  }

  try {
    const body = await request.json();
    const {
      recordingsCount = 0,
      uniqueUsers = 0,
      pageviewsTotal = 0,
      recentEventTypes = [],
      recordingsWithErrors = 0,
      topRecordingDuration,
    } = body;

    const summary = `
Dashboard metrics (last 7 days):
- Session recordings: ${recordingsCount}
- Unique users (persons): ${uniqueUsers}
- Total pageviews: ${pageviewsTotal}
- Recordings with console errors: ${recordingsWithErrors}
- Top event types: ${Array.from(new Set(recentEventTypes)).slice(0, 10).join(", ") || "none"}
${topRecordingDuration != null ? `- Longest recording: ${topRecordingDuration}s` : ""}
`.trim();

    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an analytics assistant for a product dashboard. Given metrics from PostHog (session recordings, events, pageviews), respond with exactly 3 to 5 short, actionable insight bullets. Be concise (one line per bullet). Focus on what matters: engagement, errors, trends, and suggested next steps. Output valid JSON only: { "insights": ["bullet 1", "bullet 2", ...] }. No markdown, no code block wrapper.`,
          },
          {
            role: "user",
            content: summary,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 400,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json(
        { insights: [], error: `OpenAI API error: ${res.status}` },
        { status: 200 }
      );
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      return Response.json({ insights: [] }, { status: 200 });
    }

    let insights: string[] = [];
    try {
      const parsed = JSON.parse(raw) as { insights?: string[] };
      insights = Array.isArray(parsed.insights) ? parsed.insights : [];
    } catch {
      // fallback: treat raw as plain text and split by newlines
      insights = raw
        .split(/\n/)
        .map((s) => s.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 5);
    }
    return Response.json({ insights });
  } catch {
    return Response.json({ insights: [] }, { status: 200 });
  }
}
