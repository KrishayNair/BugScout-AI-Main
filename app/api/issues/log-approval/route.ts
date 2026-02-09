import { NextRequest } from "next/server";
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

type Body = { recordingId: string; title?: string; suggestedFix?: string; rating: number };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const { recordingId, title = "", suggestedFix = "", rating } = body;
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return Response.json({ ok: false, message: "Rating must be 1-5" }, { status: 400 });
    }
    const logDir = join(process.cwd(), "logs");
    mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, "solution-approvals.log");
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      recordingId,
      title,
      suggestedFix: suggestedFix.slice(0, 2000),
      rating,
    }) + "\n";
    appendFileSync(logPath, line);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("Log approval error:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
