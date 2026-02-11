import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { issues as issuesTable } from "@/lib/db/schema";
import { posthogGet } from "@/lib/posthog-api";
import { inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getBaseUrl(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? (request.nextUrl?.protocol?.replace(":", "") ?? "http");
  return host ? `${proto}://${host}` : "";
}

/** Fetch and parse JSON; return null if response is not OK or body is not JSON (e.g. HTML 404). */
async function safeFetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    if (!res.ok || !text.trim().startsWith("{")) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const EVENT_RECORDING_ID_PREFIX = "evt-";
const DAYS_LOOKBACK = 7;
const MAX_EVENTS_PER_TYPE = 200;
const BATCH_ANALYZE = 20;

type EventRow = {
  id?: string;
  distinct_id?: string;
  timestamp?: string;
  event?: string;
  properties?: Record<string, unknown>;
};

type SessionEventDetail = {
  event: string;
  timestamp?: string;
  message?: string;
  type?: string;
  url?: string;
  element?: string;
  selector?: string;
};

function getEventId(e: EventRow): string {
  const id = e.id ?? (e.properties?.$uuid as string) ?? crypto.randomUUID();
  return String(id);
}

function getSessionId(e: EventRow): string | undefined {
  const p = e.properties ?? {};
  const v = p.$session_id ?? p.session_id;
  return v != null ? String(v) : undefined;
}

function toDetail(e: EventRow, eventName: string): SessionEventDetail {
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
}

type EventWithMeta = {
  eventId: string;
  sessionId?: string;
  eventName: string;
  detail: SessionEventDetail;
  timestamp: string;
  url?: string;
};

/**
 * Events-first sync: fetch recent $exception, $rageclick, $dead_click from PostHog,
 * group by session ID so each session's full event set is considered, discover new
 * sessions (from recordings + events), and create one issue per session with errors.
 * Event-only issues (no $session_id) still created as evt-xxx. Call on dashboard load
 * or via cron so errors are recorded and users alerted.
 */
export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);
  try {
    const after = new Date(Date.now() - DAYS_LOOKBACK * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);

    const [excRes, rageRes, deadRes] = await Promise.allSettled([
      posthogGet<{ results?: EventRow[] }>("/events/", {
        event: "$exception",
        limit: String(MAX_EVENTS_PER_TYPE),
        after,
      }),
      posthogGet<{ results?: EventRow[] }>("/events/", {
        event: "$rageclick",
        limit: String(MAX_EVENTS_PER_TYPE),
        after,
      }),
      posthogGet<{ results?: EventRow[] }>("/events/", {
        event: "$dead_click",
        limit: String(MAX_EVENTS_PER_TYPE),
        after,
      }),
    ]);

    const exceptionEvents = excRes.status === "fulfilled" && excRes.value?.results ? excRes.value.results : [];
    const rageEvents = rageRes.status === "fulfilled" && rageRes.value?.results ? rageRes.value.results : [];
    const deadEvents = deadRes.status === "fulfilled" && deadRes.value?.results ? deadRes.value.results : [];

    const allEvents: EventWithMeta[] = [];
    const add = (e: EventRow, eventName: string) => {
      const eventId = getEventId(e);
      const sessionId = getSessionId(e);
      allEvents.push({
        eventId,
        sessionId,
        eventName,
        detail: toDetail(e, eventName),
        timestamp: e.timestamp ?? new Date().toISOString(),
        url: (e.properties?.$current_url ?? e.properties?.$pathname) as string | undefined,
      });
    };
    for (const e of exceptionEvents) add(e, "$exception");
    for (const e of rageEvents) add(e, "$rageclick");
    for (const e of deadEvents) add(e, "$dead_click");

    // Dedupe by eventId
    const byEventId = new Map<string, EventWithMeta>();
    for (const ev of allEvents) {
      if (!byEventId.has(ev.eventId)) byEventId.set(ev.eventId, ev);
    }
    const uniqueEvents = Array.from(byEventId.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Group by session ID: each session gets its full set of error events for the issue agent
    const bySession = new Map<string, EventWithMeta[]>();
    const eventOnly: EventWithMeta[] = [];
    for (const ev of uniqueEvents) {
      if (ev.sessionId) {
        const list = bySession.get(ev.sessionId) ?? [];
        list.push(ev);
        bySession.set(ev.sessionId, list);
      } else {
        eventOnly.push(ev);
      }
    }

    const sessionIds = Array.from(bySession.keys());
    const allIdsToCheck = [
      ...sessionIds,
      ...eventOnly.map((ev) => `${EVENT_RECORDING_ID_PREFIX}${ev.eventId}`),
    ];

    let existingSet = new Set<string>();
    if (process.env.DATABASE_URL && allIdsToCheck.length > 0) {
      try {
        const rows = await db
          .select({ recordingId: issuesTable.recordingId })
          .from(issuesTable)
          .where(inArray(issuesTable.recordingId, allIdsToCheck));
        for (const r of rows) existingSet.add(r.recordingId);
      } catch {
        // proceed
      }
    }

    const newSessionIds = sessionIds.filter((id) => !existingSet.has(id));
    const newEventOnly = eventOnly.filter((ev) => !existingSet.has(`${EVENT_RECORDING_ID_PREFIX}${ev.eventId}`));

    let newIssuesCount = 0;

    // Helper: run analyze + suggest-fix + save for a batch of recordings and sessionEvents
    type MonitoredIssue = {
      recordingId: string;
      title?: string;
      description?: string;
      severity?: string;
      codeLocation?: string;
      codeSnippetHint?: string;
      posthogCategoryId?: string;
      posthogIssueTypeId?: string;
      startUrl?: string;
    };

    const runAgentAndSave = async (
      recordings: Array<{ recordingId: string; consoleErrorCount?: number; clickCount?: number; rageClickCount?: number; deadClickCount?: number; durationSeconds?: number; startUrl?: string; startTime?: string }>,
      sessionEvents: Record<string, SessionEventDetail[]>
    ): Promise<number> => {
      if (recordings.length === 0 || !baseUrl) return 0;
      const analyzeData = await safeFetchJson<{ issues?: MonitoredIssue[] }>(`${baseUrl}/api/issues/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordings, sessionEvents }),
      });
      const monitoredIssues: MonitoredIssue[] = Array.isArray(analyzeData?.issues) ? analyzeData.issues : [];
      const recById = new Map(recordings.map((r) => [r.recordingId, r]));
      let suggestedFixes: Array<{ recordingId: string; suggestedFix?: string; codeLocation?: string }> = [];
      if (monitoredIssues.length > 0) {
        const fixData = await safeFetchJson<{ suggestedFixes?: typeof suggestedFixes }>(
          `${baseUrl}/api/issues/suggest-fix`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ issues: monitoredIssues }),
          }
        );
        suggestedFixes = Array.isArray(fixData?.suggestedFixes) ? fixData.suggestedFixes : [];
      }
      const issuesToSave = monitoredIssues.map((m) => {
        const fix = suggestedFixes.find((f) => f.recordingId === m.recordingId);
        const rec = recById.get(m.recordingId);
        const timeFaced = rec?.startTime ? new Date(rec.startTime).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "see events";
        const prefix = `Session ID: ${m.recordingId}. Time faced: ${timeFaced}.\n\n`;
        const description = (m.description ?? "").trim().startsWith("Session ID:") ? m.description : prefix + (m.description ?? "");
        return {
          recordingId: m.recordingId,
          posthogCategoryId: m.posthogCategoryId ?? "ux",
          posthogIssueTypeId: m.posthogIssueTypeId ?? "js-frontend-errors",
          title: m.title,
          description,
          severity: m.severity,
          codeLocation: m.codeLocation ?? "",
          codeSnippetHint: m.codeSnippetHint,
          startUrl: m.startUrl,
          suggestedFix: fix?.suggestedFix,
        };
      });
      try {
        const saveRes = await fetch(`${baseUrl}/api/db/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issues: issuesToSave }),
        });
        return saveRes.ok ? issuesToSave.length : 0;
      } catch {
        return 0;
      }
    };

    // 1) Create one issue per session: use that session's full event set for the issue monitoring agent
    for (let i = 0; i < newSessionIds.length; i += BATCH_ANALYZE) {
      const batchSessionIds = newSessionIds.slice(i, i + BATCH_ANALYZE);
      const recordings = batchSessionIds.map((sessionId) => {
        const events = bySession.get(sessionId) ?? [];
        const first = events[0];
        const excCount = events.filter((e) => e.eventName === "$exception").length;
        const rageCount = events.filter((e) => e.eventName === "$rageclick").length;
        const deadCount = events.filter((e) => e.eventName === "$dead_click").length;
        return {
          recordingId: sessionId,
          consoleErrorCount: excCount,
          clickCount: 0,
          rageClickCount: rageCount,
          deadClickCount: deadCount,
          durationSeconds: 0,
          startUrl: first?.url ?? undefined,
          startTime: first?.timestamp,
        };
      });
      const sessionEvents: Record<string, SessionEventDetail[]> = {};
      for (const sessionId of batchSessionIds) {
        const events = bySession.get(sessionId) ?? [];
        sessionEvents[sessionId] = events.map((e) => e.detail);
      }
      newIssuesCount += await runAgentAndSave(recordings, sessionEvents);
    }

    // 2) Event-only (no $session_id): create evt-xxx issues as before
    for (let i = 0; i < newEventOnly.length; i += BATCH_ANALYZE) {
      const batch = newEventOnly.slice(i, i + BATCH_ANALYZE);
      const recordings = batch.map((ev) => ({
        recordingId: `${EVENT_RECORDING_ID_PREFIX}${ev.eventId}`,
        consoleErrorCount: ev.eventName === "$exception" ? 1 : 0,
        clickCount: 0,
        rageClickCount: ev.eventName === "$rageclick" ? 1 : 0,
        deadClickCount: ev.eventName === "$dead_click" ? 1 : 0,
        durationSeconds: 0,
        startUrl: ev.url ?? undefined,
        startTime: ev.timestamp,
      }));
      const sessionEvents: Record<string, SessionEventDetail[]> = {};
      for (const ev of batch) {
        sessionEvents[`${EVENT_RECORDING_ID_PREFIX}${ev.eventId}`] = [ev.detail];
      }
      newIssuesCount += await runAgentAndSave(recordings, sessionEvents);
    }

    return Response.json({
      ok: true,
      sessionsWithErrors: sessionIds.length,
      eventOnlyCount: eventOnly.length,
      newIssues: newIssuesCount,
      fromSessions: newSessionIds.length,
      fromEventOnly: newEventOnly.length,
    });
  } catch (e) {
    console.error("sync/error-events error:", e);
    const message = e instanceof Error ? e.message : "Sync failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
