import { NextRequest } from "next/server";
import { posthogGet, posthogPost } from "@/lib/posthog-api";

export const dynamic = "force-dynamic";

/** Map session_id or recording id -> { rageClickCount, deadClickCount } */
export type RageDeadCounts = Record<string, { rageClickCount: number; deadClickCount: number }>;

type RecordingInput = { id: string; distinct_id?: string; start_time?: string; end_time?: string; recording_duration?: number };

function parseHogQLResults(data: unknown): RageDeadCounts {
  const out: RageDeadCounts = {};
  const raw = data as {
    results?: unknown[];
    result?: unknown;
    query_status?: { results?: unknown[] };
  };
  const rows =
    raw?.results ??
    raw?.query_status?.results ??
    (Array.isArray(raw?.result) ? raw.result : []);
  const columns = (raw as { columns?: string[] }).columns;
  for (const row of rows) {
    if (Array.isArray(row) && columns) {
      const sidIdx = columns.indexOf("session_id");
      const rageIdx = columns.indexOf("rage_count");
      const deadIdx = columns.indexOf("dead_count");
      const sid = sidIdx >= 0 ? row[sidIdx] : null;
      const rage = rageIdx >= 0 ? Number(row[rageIdx]) || 0 : 0;
      const dead = deadIdx >= 0 ? Number(row[deadIdx]) || 0 : 0;
      if (sid != null && typeof sid === "string") out[sid] = { rageClickCount: rage, deadClickCount: dead };
    } else if (row && typeof row === "object") {
      const r = row as { session_id?: string; rage_count?: number; dead_count?: number };
      const sid = r.session_id;
      if (sid == null || typeof sid !== "string") continue;
      const rage = typeof r.rage_count === "number" ? r.rage_count : 0;
      const dead = typeof r.dead_count === "number" ? r.dead_count : 0;
      out[sid] = { rageClickCount: rage, deadClickCount: dead };
    }
  }
  return out;
}

/**
 * Fetches rage and dead click counts and maps them to recordings.
 * POST with body { recordings: [{ id, distinct_id?, start_time?, end_time?, recording_duration? }] }
 * to match by distinct_id + timestamp (reliable when recording id !== $session_id).
 * GET without body uses HogQL by session_id (assumes recording id === $session_id).
 */
export async function GET() {
  const empty: RageDeadCounts = {};
  try {
    const query = {
      query: {
        kind: "HogQLQuery",
        query: [
          "SELECT",
          "  properties.$session_id AS session_id,",
          "  countIf(event = '$rageclick') AS rage_count,",
          "  countIf(event = '$dead_click') AS dead_count",
          "FROM events",
          "WHERE timestamp >= now() - INTERVAL 7 DAY",
          "  AND (event = '$rageclick' OR event = '$dead_click')",
          "  AND properties.$session_id IS NOT NULL",
          "GROUP BY properties.$session_id",
        ].join("\n"),
      },
    };
    const data = await posthogPost("/query/", query);
    return Response.json(parseHogQLResults(data));
  } catch {
    return Response.json(empty);
  }
}

export async function POST(request: NextRequest) {
  const empty: RageDeadCounts = {};
  try {
    const body = await request.json().catch(() => ({}));
    const recordings = Array.isArray(body.recordings) ? (body.recordings as RecordingInput[]) : [];
    if (recordings.length === 0) return Response.json(empty);

    const after = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);

    const [rageRes, deadRes] = await Promise.allSettled([
      posthogGet<{ results?: Array<{ distinct_id?: string; timestamp?: string; event?: string }> }>("/events/", {
        event: "$rageclick",
        limit: "500",
        after,
      }),
      posthogGet<{ results?: Array<{ distinct_id?: string; timestamp?: string; event?: string }> }>("/events/", {
        event: "$dead_click",
        limit: "500",
        after,
      }),
    ]);

    const rageEvents = rageRes.status === "fulfilled" && rageRes.value?.results ? rageRes.value.results : [];
    const deadEvents = deadRes.status === "fulfilled" && deadRes.value?.results ? deadRes.value.results : [];

    const out: RageDeadCounts = {};
    for (const rec of recordings) {
      const did = rec.distinct_id ?? "";
      let end: number;
      if (rec.end_time) {
        end = new Date(rec.end_time).getTime();
      } else if (rec.start_time != null && rec.recording_duration != null) {
        end = new Date(rec.start_time).getTime() + rec.recording_duration * 1000;
      } else {
        end = Date.now();
      }
      const start = rec.start_time ? new Date(rec.start_time).getTime() : 0;

      let rage = 0;
      let dead = 0;
      for (const e of rageEvents) {
        if (e.distinct_id !== did) continue;
        const t = e.timestamp ? new Date(e.timestamp).getTime() : 0;
        if (t >= start && t <= end) rage++;
      }
      for (const e of deadEvents) {
        if (e.distinct_id !== did) continue;
        const t = e.timestamp ? new Date(e.timestamp).getTime() : 0;
        if (t >= start && t <= end) dead++;
      }
      if (rage > 0 || dead > 0) out[rec.id] = { rageClickCount: rage, deadClickCount: dead };
    }
    return Response.json(out);
  } catch {
    return Response.json(empty);
  }
}
