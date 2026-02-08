"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

type Recording = {
  id: string;
  distinct_id?: string;
  recording_duration?: number;
  start_time?: string;
  click_count?: number;
  console_error_count?: number;
  /** Rage clicks (repeated clicks on same element); may be present in PostHog API */
  rage_click_count?: number;
  /** Dead clicks (clicks with no effect); may be present in PostHog API */
  dead_click_count?: number;
  start_url?: string;
  person?: { distinct_id?: string };
};

type IssueFromRecording = {
  recordingId: string;
  recording: Recording;
  title: string;
  description: string;
  suggestedFix?: string;
  codeLocation?: string;
  severity: "Critical";
  instances: number;
  timeAgo: string;
  firstDetected: string;
  status: string;
};

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
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
    return `${diffDays}d ago`;
  } catch {
    return "—";
  }
}

function formatFirstDetected(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function IssuesPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<IssueFromRecording[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replayEmbedUrl, setReplayEmbedUrl] = useState<string | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  const selected = issues.find((i) => i.recordingId === selectedId) ?? issues[0] ?? null;

  const loadReplay = useCallback(async (recordingId: string) => {
    setReplayError(null);
    setReplayEmbedUrl(null);
    setReplayLoading(true);
    try {
      const res = await fetch(`/api/posthog/session-recordings/${recordingId}/embed`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load replay");
      setReplayEmbedUrl(data.embedUrl);
    } catch (e) {
      setReplayError(e instanceof Error ? e.message : "Could not load replay");
    } finally {
      setReplayLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      const t = `_t=${Date.now()}`;
      try {
        const recRes = await fetch(`/api/posthog/session-recordings?limit=50&date_from=-7d&${t}`);
        if (!recRes.ok) {
          setError("Failed to load session recordings");
          return;
        }
        const recData = await recRes.json();
        let list: Recording[] = Array.isArray(recData?.results) ? recData.results : [];

        // Enrich with rage/dead click counts: match events to recordings by distinct_id + time window
        try {
          const payload = list.map((r) => {
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
          if (rageRes.ok) {
            const rageData = (await rageRes.json()) as Record<
              string,
              { rageClickCount?: number; deadClickCount?: number }
            >;
            list = list.map((r) => ({
              ...r,
              rage_click_count:
                r.rage_click_count ?? rageData[r.id]?.rageClickCount ?? 0,
              dead_click_count:
                r.dead_click_count ?? rageData[r.id]?.deadClickCount ?? 0,
            }));
          }
        } catch {
          // fallback: try GET (HogQL by session_id) in case POST not supported or fails
          try {
            const rageRes = await fetch(`/api/posthog/rage-dead-clicks?${t}`);
            if (rageRes.ok) {
              const rageData = (await rageRes.json()) as Record<
                string,
                { rageClickCount?: number; deadClickCount?: number }
              >;
              list = list.map((r) => ({
                ...r,
                rage_click_count: r.rage_click_count ?? rageData[r.id]?.rageClickCount ?? 0,
                dead_click_count: r.dead_click_count ?? rageData[r.id]?.deadClickCount ?? 0,
              }));
            }
          } catch {
            // ignore
          }
        }

        const hasIssues = (r: Recording) =>
          (r.console_error_count != null && r.console_error_count > 0) ||
          (r.rage_click_count != null && r.rage_click_count > 0) ||
          (r.dead_click_count != null && r.dead_click_count > 0);
        const withErrors = list.filter(hasIssues);

        if (cancelled || withErrors.length === 0) {
          setIssues([]);
          setSelectedId(null);
          setLoading(false);
          return;
        }

        const summaries = withErrors.map((r) => ({
          recordingId: r.id,
          consoleErrorCount: r.console_error_count ?? 0,
          clickCount: r.click_count ?? 0,
          rageClickCount: r.rage_click_count,
          deadClickCount: r.dead_click_count,
          durationSeconds: r.recording_duration,
          startUrl: r.start_url,
          startTime: r.start_time,
        }));

        const analyzeRes = await fetch("/api/issues/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordings: summaries }),
        });
        const analyzeData = await analyzeRes.json();
        const analyzed = Array.isArray(analyzeData?.issues) ? analyzeData.issues : [];

        const built: IssueFromRecording[] = withErrors.map((rec) => {
          const a = analyzed.find((x: { recordingId: string }) => x.recordingId === rec.id) as
            | { recordingId: string; title?: string; description?: string; suggestedFix?: string; codeLocation?: string }
            | undefined;
          const errs = rec.console_error_count ?? 0;
          const rage = rec.rage_click_count ?? 0;
          const dead = rec.dead_click_count ?? 0;
          const parts: string[] = [];
          if (errs > 0) parts.push(`${errs} console error(s)`);
          if (rage > 0) parts.push(`${rage} rage click(s)`);
          if (dead > 0) parts.push(`${dead} dead click(s)`);
          const fallbackTitle =
            parts.length > 0 ? `Session with ${parts.join(", ")}` : "Session with issues";
          const fallbackDesc =
            parts.length > 0
              ? `This session had ${parts.join(", ")} and ${rec.click_count ?? 0} total clicks. Watch the replay to investigate.`
              : `Watch the replay to investigate.`;
          return {
            recordingId: rec.id,
            recording: rec,
            title: a?.title ?? fallbackTitle,
            description: a?.description ?? fallbackDesc,
            suggestedFix: a?.suggestedFix,
            codeLocation: a?.codeLocation,
            severity: "Critical",
            instances: 1,
            timeAgo: formatTimeAgo(rec.start_time),
            firstDetected: formatFirstDetected(rec.start_time),
            status: "Unresolved",
          };
        });

        if (!cancelled) {
          setIssues(built);
          setSelectedId(built[0].recordingId);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load issues");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selected?.recordingId) return;
    loadReplay(selected.recordingId);
  }, [selected?.recordingId, loadReplay]);

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2">
            <WarningIcon className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold text-gray-900">Issues</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
              <div className="text-right text-sm">
                <p className="font-medium text-gray-900">{user?.firstName ?? user?.username ?? "User"}</p>
                <p className="text-gray-500">{user?.primaryEmailAddress?.emailAddress ?? ""}</p>
              </div>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-gray-500">Loading issues from session recordings…</p>
          </div>
        </div>
      </div>
    );
  }

  const criticalCount = issues.length;
  const filters = [
    { label: "Critical", count: criticalCount, active: true },
    { label: "All", count: criticalCount, active: false },
    { label: "Resolved", count: 0, active: false },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          <WarningIcon className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold text-gray-900">Issues</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Mark Resolved
          </button>
          <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
            <div className="text-right text-sm">
              <p className="font-medium text-gray-900">{user?.firstName ?? user?.username ?? "User"}</p>
              <p className="text-gray-500">{user?.primaryEmailAddress?.emailAddress ?? ""}</p>
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {issues.length === 0 && !error && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white p-8">
            <p className="text-gray-500">No issues from session recordings. Recordings with console errors will appear here.</p>
          </div>
        )}

        {issues.length > 0 && selected && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{selected.title}</h2>
              <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700">
                  {selected.severity}
                </span>
                <span>First detected {selected.firstDetected}</span>
                <span>
                  {[
                    (selected.recording.console_error_count ?? 0) > 0 && `${selected.recording.console_error_count} errors`,
                    (selected.recording.rage_click_count ?? 0) > 0 && `${selected.recording.rage_click_count} rage`,
                    (selected.recording.dead_click_count ?? 0) > 0 && `${selected.recording.dead_click_count} dead`,
                    `${selected.recording.click_count ?? 0} clicks`,
                  ].filter(Boolean).join(" · ")}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                {filters.map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                      f.active
                        ? "border-red-500 text-red-600"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
              <div className="flex w-[380px] shrink-0 flex-col overflow-hidden">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Critical Issues ({issues.length})
                </h3>
                <div className="flex flex-col gap-2 overflow-y-auto">
                  {issues.map((issue) => (
                    <button
                      key={issue.recordingId}
                      type="button"
                      onClick={() => setSelectedId(issue.recordingId)}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        selectedId === issue.recordingId
                          ? "border-primary bg-primary/5"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <p className="font-medium text-gray-900">{issue.title}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <span className="text-red-600">{issue.severity}</span>
                        <span>
                          {[
                            (issue.recording.console_error_count ?? 0) > 0 && `${issue.recording.console_error_count} err`,
                            (issue.recording.rage_click_count ?? 0) > 0 && `${issue.recording.rage_click_count} rage`,
                            (issue.recording.dead_click_count ?? 0) > 0 && `${issue.recording.dead_click_count} dead`,
                          ].filter(Boolean).join(", ")}
                        </span>
                        <span>{issue.timeAgo}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-gray-600">{issue.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto">
                <section className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center gap-2">
                    <WarningIcon className="h-5 w-5 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">Issue Description</h3>
                  </div>
                  <div className="mt-3">
                    <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-800">
                      {selected.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">{selected.description}</p>
                  {selected.codeLocation && (
                    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                        Where in the code
                      </p>
                      <p className="mt-1 font-mono text-sm text-gray-800">{selected.codeLocation}</p>
                    </div>
                  )}
                  {selected.suggestedFix && (
                    <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-green-700">
                        Suggested fix
                      </p>
                      <p className="mt-1 text-sm text-gray-700">{selected.suggestedFix}</p>
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center gap-2">
                    <EyeIcon className="h-5 w-5 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">Related Session</h3>
                  </div>
                  <div className="mt-4">
                    <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                      <div className="aspect-video w-full min-h-[240px] bg-gray-200">
                        {replayLoading && (
                          <div className="flex h-full w-full items-center justify-center">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          </div>
                        )}
                        {replayError && !replayLoading && (
                          <div className="flex h-full w-full items-center justify-center p-4 text-sm text-red-600">
                            {replayError}
                          </div>
                        )}
                        {replayEmbedUrl && !replayLoading && (
                          <iframe
                            src={replayEmbedUrl}
                            title="Session replay"
                            className="h-full w-full border-0"
                            allow="fullscreen"
                          />
                        )}
                      </div>
                      <div className="border-t border-gray-200 px-3 py-2 text-xs text-gray-500">
                        {selected.recordingId.slice(0, 8)}… · {selected.timeAgo}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
