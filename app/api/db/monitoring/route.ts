import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { monitoring } from "@/lib/db/schema";
import { VectorSyncService } from "@/lib/vector-sync.service";

type RecordingPayload = {
  id: string;
  distinct_id?: string;
  recording_duration?: number;
  start_time?: string;
  click_count?: number;
  console_error_count?: number;
  rage_click_count?: number;
  dead_click_count?: number;
  start_url?: string;
  [key: string]: unknown;
};

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false, message: "DATABASE_URL not set" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const list = Array.isArray(body.recordings) ? (body.recordings as RecordingPayload[]) : [];
    if (list.length === 0) return Response.json({ ok: true, inserted: 0 });

    const rows = list.map((r) => ({
      userId,
      recordingId: r.id,
      distinctId: r.distinct_id ?? null,
      recordingDuration: r.recording_duration ?? null,
      startTime: r.start_time ? new Date(r.start_time) : null,
      clickCount: r.click_count ?? null,
      consoleErrorCount: r.console_error_count ?? null,
      rageClickCount: r.rage_click_count ?? null,
      deadClickCount: r.dead_click_count ?? null,
      startUrl: r.start_url ?? null,
      payload: r as unknown as Record<string, unknown>,
    }));

    await db
      .insert(monitoring)
      .values(rows)
      .onConflictDoNothing({ target: [monitoring.userId, monitoring.recordingId] });

    VectorSyncService.syncMonitoring(rows).catch(() => {});

    return Response.json({ ok: true, inserted: rows.length });
  } catch (e) {
    console.error("POST /api/db/monitoring error:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
