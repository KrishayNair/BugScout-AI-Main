"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

const POSTHOG_RECORDINGS_BASE = "https://eu.posthog.com/project/123893/recordings";
const DEFAULT_DAYS = 30;
const ENRICH_BATCH = 100; // batch size for rage/dead enrichment to avoid huge payloads

type Session = {
  id: string;
  distinct_id?: string;
  recording_duration?: number;
  start_time?: string;
  start_url?: string;
  click_count?: number;
  console_error_count?: number;
  rage_click_count?: number;
  dead_click_count?: number;
  person?: { name?: string; distinct_id?: string };
};

function SessionsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function formatDuration(seconds: number | undefined): string {
  if (seconds == null || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

function formatTimeAgo(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

function formatFullDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export default function SessionsPage() {
  const { user } = useUser();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [loadProgress, setLoadProgress] = useState<string | null>(null);
  const [replayId, setReplayId] = useState<string | null>(null);
  const [replayEmbedUrl, setReplayEmbedUrl] = useState<string | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);

  const loadReplay = useCallback(async (sessionId: string) => {
    setReplayId(sessionId);
    setReplayEmbedUrl(null);
    setReplayLoading(true);
    try {
      const res = await fetch(`/api/posthog/session-recordings/${sessionId}/embed`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load replay");
      setReplayEmbedUrl(data.embedUrl);
    } catch (e) {
      setReplayEmbedUrl(null);
    } finally {
      setReplayLoading(false);
    }
  }, []);

  const enrichWithRageDead = useCallback(async (list: Session[]): Promise<Session[]> => {
    if (list.length === 0) return list;
    const t = `_t=${Date.now()}`;
    const out: Session[] = [];
    for (let i = 0; i < list.length; i += ENRICH_BATCH) {
      const batch = list.slice(i, i + ENRICH_BATCH);
      try {
        const payload = batch.map((r) => {
          const start = r.start_time ? new Date(r.start_time).getTime() : 0;
          const duration = (r.recording_duration ?? 0) * 1000;
          return {
            id: r.id,
            distinct_id: r.distinct_id ?? r.person?.distinct_id,
            start_time: r.start_time,
            end_time: duration ? new Date(start + duration).toISOString() : undefined,
            recording_duration: r.recording_duration,
          };
        });
        const rageRes = await fetch(`/api/posthog/rage-dead-clicks?${t}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordings: payload }),
        });
        if (!rageRes.ok) {
          out.push(...batch);
          continue;
        }
        const rageData = (await rageRes.json()) as Record<string, { rageClickCount?: number; deadClickCount?: number }>;
        batch.forEach((rec) => {
          out.push({
            ...rec,
            rage_click_count: rageData[rec.id]?.rageClickCount ?? rec.rage_click_count,
            dead_click_count: rageData[rec.id]?.deadClickCount ?? rec.dead_click_count,
          });
        });
      } catch {
        out.push(...batch);
      }
    }
    return out;
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadProgress("Fetching all sessions from PostHog…");
    try {
      const dateFrom = `-${days}d`;
      const res = await fetch(
        `/api/posthog/session-recordings/all?date_from=${dateFrom}&max=5000&_t=${Date.now()}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load sessions");
      let list: Session[] = Array.isArray(data?.results) ? data.results : [];
      setLoadProgress(list.length > 0 ? `Enriching ${list.length} sessions…` : null);
      list = await enrichWithRageDead(list);
      setSessions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions");
      setSessions([]);
    } finally {
      setLoading(false);
      setLoadProgress(null);
    }
  }, [days, enrichWithRageDead]);

  useEffect(() => {
    fetchSessions();
  }, [days]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-primary/10 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <SessionsIcon className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold text-gray-900">Sessions</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-primary/10 bg-white/80 px-2 py-1 shadow-sm">
            <span className="text-sm text-gray-600">Period:</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded border-0 bg-transparent text-sm font-medium text-gray-900 focus:ring-0"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium text-gray-900">{user?.firstName ?? user?.username ?? "User"}</p>
            <p className="text-gray-500">{user?.primaryEmailAddress?.emailAddress ?? ""}</p>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-gray-600">{loadProgress ?? "Loading sessions…"}</p>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white p-8">
            <p className="text-gray-500">No sessions in the selected period. Adjust the date range or check PostHog.</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Showing all {sessions.length} session{sessions.length !== 1 ? "s" : ""} from PostHog (Session ID = recording id)
              </p>
            </div>

            <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
              <div className="min-w-0 flex-1 overflow-auto rounded-2xl border border-primary/10 bg-white shadow-lg shadow-primary/5">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 border-b border-primary/10 bg-gray-50/95 text-left text-gray-600 backdrop-blur-sm">
                    <tr>
                      <th className="px-4 py-3 font-medium">Session ID</th>
                      <th className="px-4 py-3 font-medium">Start time</th>
                      <th className="px-4 py-3 font-medium">Duration</th>
                      <th className="px-4 py-3 font-medium">Start URL</th>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Clicks</th>
                      <th className="px-4 py-3 font-medium">Errors</th>
                      <th className="px-4 py-3 font-medium">Rage</th>
                      <th className="px-4 py-3 font-medium">Dead</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-gray-100 last:border-0 transition-colors hover:bg-primary/5"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-700" title={s.id}>
                          {s.id.slice(0, 8)}…
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <span title={s.start_time}>{formatFullDateTime(s.start_time)}</span>
                          <br />
                          <span className="text-xs text-gray-400">{formatTimeAgo(s.start_time)}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatDuration(s.recording_duration)}</td>
                        <td className="max-w-[180px] truncate px-4 py-3 text-gray-600" title={s.start_url}>
                          {s.start_url || "—"}
                        </td>
                        <td className="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-gray-600" title={s.distinct_id ?? s.person?.distinct_id}>
                          {s.distinct_id ?? s.person?.distinct_id ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{s.click_count ?? "—"}</td>
                        <td className="px-4 py-3">
                          {s.console_error_count != null && s.console_error_count > 0 ? (
                            <span className="font-medium text-red-600">{s.console_error_count}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {s.rage_click_count != null && s.rage_click_count > 0 ? (
                            <span className="font-medium text-amber-600">{s.rage_click_count}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {s.dead_click_count != null && s.dead_click_count > 0 ? (
                            <span className="font-medium text-amber-600">{s.dead_click_count}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => loadReplay(s.id)}
                              className="font-medium text-primary hover:underline"
                            >
                              Watch
                            </button>
                            <span className="text-gray-300">|</span>
                            <a
                              href={`${POSTHOG_RECORDINGS_BASE}/${s.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-500 hover:text-gray-700"
                            >
                              PostHog →
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {replayId && (
                <div className="flex w-[420px] shrink-0 flex-col rounded-2xl border border-primary/10 bg-white p-4 shadow-lg shadow-primary/5">
                  <h3 className="mb-2 text-sm font-semibold text-gray-900">Session replay</h3>
                  <p className="mb-2 truncate font-mono text-xs text-gray-500" title={replayId}>
                    {replayId}
                  </p>
                  <div className="flex-1 overflow-hidden rounded-xl border border-primary/10 bg-gray-100">
                    {replayLoading ? (
                      <div className="flex h-[240px] items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    ) : replayEmbedUrl ? (
                      <iframe
                        src={replayEmbedUrl}
                        title="Session replay"
                        className="h-full min-h-[280px] w-full border-0"
                        allow="fullscreen"
                      />
                    ) : (
                      <div className="flex h-[240px] items-center justify-center text-sm text-gray-500">
                        Click Watch on a session
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
