"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

const POSTHOG_RECORDINGS_BASE = "https://eu.posthog.com/project/123893/recordings";

type Recording = {
  id: string;
  recording_duration?: number;
  start_time?: string;
  click_count?: number;
  console_error_count?: number;
  person?: { name?: string; distinct_id?: string };
  start_url?: string;
};

type Event = {
  id?: string;
  event?: string;
  timestamp?: string;
  distinct_id?: string;
  properties?: Record<string, unknown> | string;
  elements_chain?: string;
};

type QueryResult = {
  results?: Array<{ data?: number[]; labels?: string[]; count?: number }>;
  result?: unknown;
};

function formatDuration(seconds: number | undefined): string {
  if (seconds == null || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}

function IssuesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function IntegrationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

/** Extract human-readable details from event properties for display */
function getEventDetails(e: Event): { url?: string; element?: string } {
  let props: Record<string, unknown> = {};
  if (typeof e.properties === "object" && e.properties) props = e.properties;
  else if (typeof e.properties === "string") {
    try {
      props = JSON.parse(e.properties || "{}") as Record<string, unknown>;
    } catch {
      props = {};
    }
  }
  const url =
    (props.$current_url as string) ??
    (props.$pathname as string) ??
    (props.$pageview_url as string);
  const chain = (e.elements_chain ?? props.elements_chain ?? props.$elements_chain) as string | undefined;
  let element: string | undefined;
  if (chain && typeof chain === "string") {
    const first = chain.split(";").find(Boolean);
    if (first) {
      const textMatch = first.match(/text="([^"]*)"/);
      const tagMatch = first.match(/^([a-z0-9]+)/i);
      const idMatch = first.match(/attr__id="([^"]*)"/);
      const hrefMatch = first.match(/attr__href="([^"]*)"/);
      element =
        (textMatch?.[1] && textMatch[1].length < 60 ? textMatch[1] : null) ??
        (idMatch?.[1] ? `#${idMatch[1]}` : null) ??
        (hrefMatch?.[1] ? `href="${hrefMatch[1].slice(0, 40)}${hrefMatch[1].length > 40 ? "…" : ""}"` : null) ??
        (tagMatch?.[1] ? `<${tagMatch[1]}>` : null) ??
        first.slice(0, 60) + (first.length > 60 ? "…" : "");
    }
  }
  return { url, element };
}

function formatTime(iso: string | undefined): string {
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
    return iso.slice(0, 16);
  }
}

export default function DashboardHomePage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [trendData, setTrendData] = useState<number[]>([]);
  const [flagsCount, setFlagsCount] = useState<number | null>(null);
  const [replayEmbedUrl, setReplayEmbedUrl] = useState<string | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  async function openReplay(recordingId: string) {
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
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      const t = `_t=${Date.now()}`;
      try {
        const [recRes, eventsRes, queryRes, flagsRes] = await Promise.allSettled([
          fetch(`/api/posthog/session-recordings?limit=20&date_from=-7d&${t}`),
          fetch(`/api/posthog/events?limit=50&${t}`),
          fetch("/api/posthog/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: {
                kind: "TrendsQuery",
                series: [{ event: "$pageview" }],
                interval: "day",
              },
            }),
          }),
          fetch(`/api/posthog/feature-flags?${t}`),
        ]);

        if (cancelled) return;

        const apiErrors: string[] = [];
        if (recRes.status === "rejected") apiErrors.push("Recordings failed");
        if (eventsRes.status === "rejected") apiErrors.push("Events failed");
        if (queryRes.status === "rejected") apiErrors.push("Query failed");
        if (flagsRes.status === "rejected") apiErrors.push("Flags failed");
        if (recRes.status === "fulfilled" && !recRes.value.ok) apiErrors.push(`Recordings ${recRes.value.status}`);
        if (eventsRes.status === "fulfilled" && !eventsRes.value.ok) apiErrors.push(`Events ${eventsRes.value.status}`);
        if (queryRes.status === "fulfilled" && !queryRes.value.ok) apiErrors.push(`Query ${queryRes.value.status}`);
        if (flagsRes.status === "fulfilled" && !flagsRes.value.ok) apiErrors.push(`Flags ${flagsRes.value.status}`);

        const recData = recRes.status === "fulfilled" && recRes.value.ok ? await recRes.value.json() : null;
        const recordingsList = Array.isArray(recData?.results) ? recData.results : [];
        setRecordings(recordingsList);

        const eventsData = eventsRes.status === "fulfilled" && eventsRes.value.ok ? await eventsRes.value.json() : null;
        if (eventsData?.results) setEvents(eventsData.results);

        const queryData = queryRes.status === "fulfilled" && queryRes.value.ok ? await queryRes.value.json() : null;
        const series = queryData?.results?.[0] ?? queryData?.result?.results?.[0];
        if (series?.data) setTrendData(Array.isArray(series.data) ? series.data : []);

        const flagsData = flagsRes.status === "fulfilled" && flagsRes.value.ok ? await flagsRes.value.json() : null;
        const flags = flagsData?.results ?? flagsData;
        setFlagsCount(Array.isArray(flags) ? flags.length : 0);

        if (!cancelled && apiErrors.length > 0) {
          setError(`PostHog API: ${apiErrors.join("; ")}. Check NEXT_POST_HOG_KEY and Integration.`);
        }

        if (!cancelled) {
          setInsightsLoading(true);
          fetch("/api/insights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recordingsCount: recData?.results?.length ?? 0,
              uniqueUsers: 0,
              pageviewsTotal: series?.data
                ? (Array.isArray(series.data) ? series.data : []).reduce((a: number, b: unknown) => a + (Number(b) || 0), 0)
                : 0,
              recentEventTypes: (eventsData?.results ?? []).map((e: Event) => e.event).filter(Boolean),
              recordingsWithErrors: (recData?.results ?? []).filter(
                (r: Recording) => r.console_error_count != null && r.console_error_count > 0
              ).length,
              topRecordingDuration:
                (recData?.results ?? []).length > 0
                  ? Math.max(
                      ...(recData.results as Recording[])
                        .map((r) => r.recording_duration ?? 0)
                        .filter((n) => n > 0)
                    )
                  : null,
            }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (!cancelled && Array.isArray(data.insights)) setInsights(data.insights);
            })
            .finally(() => {
              if (!cancelled) setInsightsLoading(false);
            });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader user={user} />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-gray-500">Loading analytics…</p>
          </div>
        </div>
      </div>
    );
  }

  const recordingsWithErrors = recordings.filter(
    (r) => r.console_error_count != null && r.console_error_count > 0
  ).length;
  const totalPageviews = trendData.length
    ? trendData.reduce((a, b) => a + (Number(b) || 0), 0)
    : 0;
  const maxTrend = trendData.length ? Math.max(...trendData.map(Number), 1) : 1;

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader user={user} />
      <div className="flex-1 min-h-0 overflow-auto p-6">
        {/* Welcome + Quick actions */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Overview</h2>
            <p className="mt-1 text-sm text-gray-500">
              Last 7 days · Session replays, events & pageviews from PostHog
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/issues"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
            >
              <IssuesIcon className="h-4 w-4" />
              View issues
            </Link>
            <Link
              href="/dashboard/integration"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-gray-50 hover:shadow-md"
            >
              <IntegrationIcon className="h-4 w-4" />
              Integration
            </Link>
          </div>
        </div>

        {/* KPI row */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Session recordings" value={recordings.length} sub="Last 7 days" highlight />
          <KpiCard title="Pageviews" value={totalPageviews.toLocaleString()} sub="Last 7 days" />
          <KpiCard title="Sessions with errors" value={recordingsWithErrors} sub="Console / rage / dead" />
          <KpiCard title="Feature flags" value={flagsCount ?? "—"} sub="Active" />
        </div>

        {/* AI Insights - full width */}
        <section className="group relative mb-8 overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.06] via-white to-primary/[0.04] p-6 shadow-lg shadow-primary/5 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 sm:p-8">
          {/* Subtle grid pattern */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "24px 24px" }} />
          <div className="relative">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 shadow-inner ring-2 ring-primary/10 transition-transform duration-300 group-hover:scale-105">
                <SparklesIcon className="h-6 w-6 text-primary drop-shadow-sm" />
              </span>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-gray-900">AI Insights</h3>
                <p className="mt-0.5 text-sm text-gray-500">Summary from your analytics</p>
              </div>
            </div>
            {insightsLoading ? (
              <div className="mt-6 flex items-center gap-3 rounded-xl bg-white/70 py-4 px-4 backdrop-blur-sm">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                <span className="text-sm font-medium text-gray-600">Generating insights…</span>
              </div>
            ) : insights.length > 0 ? (
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {insights.map((line, i) => (
                  <li
                    key={i}
                    className="animate-insight-in flex gap-3 rounded-xl border border-white/80 bg-white/80 py-3.5 px-4 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md hover:shadow-primary/5"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary ring-4 ring-primary/10" />
                    <span className="text-sm leading-relaxed text-gray-700">{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-white/60 py-6 px-5 text-center">
                <p className="text-sm text-gray-600">
                  Add <code className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">OPENAI_API_KEY</code> to .env.local for AI-powered insights.
                </p>
              </div>
            )}
          </div>
        </section>

        {(replayEmbedUrl || replayLoading || replayError) && (
          <ReplayModal
            embedUrl={replayEmbedUrl}
            loading={replayLoading}
            error={replayError}
            onClose={() => {
              setReplayEmbedUrl(null);
              setReplayError(null);
            }}
          />
        )}

        {/* Main grid: Recordings + Chart | Events */}
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 space-y-6">
            <section className="rounded-2xl border border-primary/10 bg-white p-6 shadow-lg shadow-primary/5 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Session recordings</h3>
                  <p className="mt-0.5 text-sm text-gray-500">Watch replay or open in PostHog</p>
                </div>
                {recordings.length > 0 && (
                  <span className="rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-xs font-medium text-gray-700">
                    {recordings.length} total
                  </span>
                )}
              </div>
              <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
                {recordings.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm text-gray-500">No recordings yet</p>
                    <p className="mt-1 text-xs text-gray-400">Enable session replay in PostHog</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-gray-600">
                        <th className="px-4 py-3 font-medium">Session</th>
                        <th className="px-4 py-3 font-medium">Duration</th>
                        <th className="px-4 py-3 font-medium">Clicks</th>
                        <th className="px-4 py-3 font-medium">Errors</th>
                        <th className="px-4 py-3 font-medium">Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recordings.slice(0, 10).map((r) => (
                        <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openReplay(r.id)}
                                className="font-medium text-primary hover:underline"
                              >
                                Watch
                              </button>
                              <span className="text-gray-300">|</span>
                              <a
                                href={`${POSTHOG_RECORDINGS_BASE}/${r.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-500 hover:text-gray-700"
                              >
                                PostHog →
                              </a>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{formatDuration(r.recording_duration)}</td>
                          <td className="px-4 py-3 text-gray-600">{r.click_count ?? "—"}</td>
                          <td className="px-4 py-3">
                            {r.console_error_count != null && r.console_error_count > 0 ? (
                              <span className="font-medium text-red-600">{r.console_error_count}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{formatTime(r.start_time)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {trendData.length > 0 && (
              <section className="rounded-2xl border border-primary/10 bg-white p-6 shadow-lg shadow-primary/5 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
                <h3 className="text-base font-semibold text-gray-900">Pageviews · Last 7 days</h3>
                <div className="mt-4 flex items-end gap-1.5">
                  {trendData.map((val, i) => (
                    <div
                      key={i}
                      className="flex flex-1 flex-col items-center gap-1"
                      title={`Day ${i + 1}: ${val}`}
                    >
                      <div
                        className="w-full rounded-t bg-primary/80 min-h-[6px] transition hover:bg-primary"
                        style={{
                          height: `${Math.max(12, (Number(val) / maxTrend) * 120)}px`,
                        }}
                      />
                      <span className="text-[10px] text-gray-400">D{i + 1}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">Total: {totalPageviews.toLocaleString()} pageviews</p>
              </section>
            )}
          </div>

          <section className="rounded-2xl border border-primary/10 bg-white p-6 shadow-lg shadow-primary/5 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Recent events</h3>
                <p className="mt-0.5 text-sm text-gray-500">Latest from PostHog</p>
              </div>
              {events.length > 0 && (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                  {events.length} shown
                </span>
              )}
            </div>
            <ul className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {events.length === 0 ? (
                <li className="rounded-xl border border-dashed border-primary/10 py-8 text-center text-sm text-gray-500">
                  No events yet
                </li>
              ) : (
                events.slice(0, 20).map((e, i) => {
                  const { url, element } = getEventDetails(e);
                  return (
                    <li
                      key={e.id ?? i}
                      className="rounded-xl border border-primary/5 bg-white/80 p-3 text-sm shadow-sm transition hover:-translate-y-0.5 hover:border-primary/15 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-gray-900">{e.event ?? "—"}</span>
                        <span className="shrink-0 text-xs text-gray-500">{formatTime(e.timestamp)}</span>
                      </div>
                      {(url || element) && (
                        <div className="mt-2 space-y-1 text-xs text-gray-600">
                          {url && (
                            <p className="truncate" title={url}>
                              <span className="font-medium text-gray-500">Where:</span> {url}
                            </p>
                          )}
                          {element && (
                            <p className="truncate" title={element}>
                              <span className="font-medium text-gray-500">Element:</span> {element}
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function ReplayModal({
  embedUrl,
  loading,
  error,
  onClose,
}: {
  embedUrl: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-primary/10 bg-white shadow-2xl shadow-primary/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="text-lg font-semibold text-gray-900">Session replay</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="relative min-h-[400px] flex-1 overflow-hidden bg-gray-100">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          {error && (
            <div className="flex h-64 items-center justify-center px-4 text-center text-sm text-red-600">
              {error}
            </div>
          )}
          {embedUrl && !loading && (
            <iframe
              src={embedUrl}
              title="Session replay"
              className="h-full min-h-[450px] w-full border-0"
              allowFullScreen
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardHeader({ user }: { user: { firstName?: string | null; username?: string | null; primaryEmailAddress?: { emailAddress?: string } | null } | null | undefined }) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-primary/10 bg-white px-6 py-4 shadow-sm">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
      </div>
      <div className="flex items-center gap-3 border-l border-primary/10 pl-4">
        <div className="text-right text-sm">
          <p className="font-medium text-gray-900">{user?.firstName ?? user?.username ?? "User"}</p>
          <p className="text-gray-500">{user?.primaryEmailAddress?.emailAddress ?? ""}</p>
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}

function KpiCard({
  title,
  value,
  sub,
  highlight,
}: {
  title: string;
  value: React.ReactNode;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 shadow-lg transition-all duration-300 hover:shadow-xl ${
        highlight
          ? "border border-primary/20 bg-gradient-to-br from-primary to-primary-dark text-white shadow-primary/20 hover:shadow-primary/30"
          : "border border-primary/10 bg-white shadow-primary/5 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-primary/10"
      }`}
    >
      <p className={`text-2xl font-bold ${highlight ? "text-white" : "text-gray-900"}`}>{value}</p>
      <p className={`mt-0.5 text-sm ${highlight ? "text-white/90" : "text-gray-500"}`}>{title}</p>
      <p className={`mt-1 text-xs ${highlight ? "text-white/80" : "text-gray-400"}`}>{sub}</p>
    </div>
  );
}
