import { NextRequest } from "next/server";
import { posthogGet, posthogPost } from "@/lib/posthog-api";

export const dynamic = "force-dynamic";

/** One event for issue analysis (exception, rage click, dead click). */
export type SessionEventDetail = {
  event: string;
  timestamp?: string;
  message?: string;
  type?: string;
  url?: string;
  element?: string;
  selector?: string;
};

type RecordingInput = {
  id: string;
  distinct_id?: string;
  start_time?: string;
  end_time?: string;
  recording_duration?: number;
};

export type SessionEventsResponse = Record<string, SessionEventDetail[]>;

/**
 * Fetches detailed events ($exception, $rageclick, $dead_click) for the given recordings
 * so the issue analyzer can see actual messages, URLs, and elements — not just counts.
 */
export async function POST(request: NextRequest) {
  const empty: SessionEventsResponse = {};
  try {
    const body = await request.json().catch(() => ({}));
    const recordings = Array.isArray(body.recordings) ? (body.recordings as RecordingInput[]) : [];
    if (recordings.length === 0) return Response.json(empty);

    const after = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);

    type EventRow = {
      distinct_id?: string;
      timestamp?: string;
      event?: string;
      properties?: Record<string, unknown>;
    };

    const getSessionId = (e: EventRow): string | undefined => {
      const p = e.properties ?? {};
      const v = p.$session_id ?? p.session_id;
      return v != null ? String(v) : undefined;
    };

    const [excRes, rageRes, deadRes] = await Promise.allSettled([
      posthogGet<{ results?: EventRow[] }>("/events/", {
        event: "$exception",
        limit: "200",
        after,
      }),
      posthogGet<{ results?: EventRow[] }>("/events/", {
        event: "$rageclick",
        limit: "200",
        after,
      }),
      posthogGet<{ results?: EventRow[] }>("/events/", {
        event: "$dead_click",
        limit: "200",
        after,
      }),
    ]);

    const exceptionEvents = excRes.status === "fulfilled" && excRes.value?.results ? excRes.value.results : [];
    const rageEvents = rageRes.status === "fulfilled" && rageRes.value?.results ? rageRes.value.results : [];
    const deadEvents = deadRes.status === "fulfilled" && deadRes.value?.results ? deadRes.value.results : [];

    const eventsByRecording: SessionEventsResponse = {};
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

      const matches = (e: EventRow): boolean => {
        const eventSessionId = getSessionId(e);
        if (eventSessionId === rec.id) return true;
        if (did && e.distinct_id === did) {
          const t = e.timestamp ? new Date(e.timestamp).getTime() : 0;
          return t >= start && t <= end;
        }
        return false;
      };

      const toDetail = (e: EventRow, eventName: string): SessionEventDetail => {
        const props = e.properties ?? {};
        const get = (k: string): string | undefined => {
          const v = props[k];
          return v != null ? String(v) : undefined;
        };
        return {
          event: eventName,
          timestamp: e.timestamp,
          message: get("$exception_message") ?? get("message"),
          type: get("$exception_type") ?? get("type"),
          url: get("$current_url") ?? get("$pathname"),
          element: get("$element") ?? get("tag_name"),
          selector: get("$selector"),
        };
      };

      const list: SessionEventDetail[] = [];
      for (const e of exceptionEvents) {
        if (matches(e)) list.push(toDetail(e, "$exception"));
      }
      for (const e of rageEvents) {
        if (matches(e)) list.push(toDetail(e, "$rageclick"));
      }
      for (const e of deadEvents) {
        if (matches(e)) list.push(toDetail(e, "$dead_click"));
      }
      if (list.length > 0) eventsByRecording[rec.id] = list;
    }

    return Response.json(eventsByRecording);
  } catch (e) {
    console.error("session-events error:", e);
    return Response.json(empty);
  }
}
