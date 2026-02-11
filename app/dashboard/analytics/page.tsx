"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

type TrendPoint = { value: number; label?: string };
type FunnelStep = { count: number; label?: string; dropOff?: number; dropOffPct?: number; convertTime?: string };

function AnalyticsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function runQuery(body: unknown): Promise<unknown> {
  return fetch("/api/posthog/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))));
}

export default function WebAnalyticsPage() {
  const { user } = useUser();
  const [period, setPeriod] = useState<"7" | "14" | "30" | "90">("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dauData, setDauData] = useState<TrendPoint[]>([]);
  const [wauData, setWauData] = useState<TrendPoint[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([]);
  const [referringData, setReferringData] = useState<{ label: string; value: number }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const dateFrom = `-${period}d`;
    try {
      const [dauRes, wauRes, funnelRes, referringRes] = await Promise.allSettled([
        runQuery({
          query: {
            kind: "TrendsQuery",
            series: [{ event: "$pageview", math: "dau" }],
            interval: "day",
            ...(dateFrom && { dateRange: { date_from: dateFrom } }),
          },
        }),
        runQuery({
          query: {
            kind: "TrendsQuery",
            series: [{ event: "$pageview", math: "dau" }],
            interval: "week",
            dateRange: { date_from: period === "7" || period === "14" ? "-30d" : dateFrom },
          },
        }),
        runQuery({
          query: {
            kind: "FunnelsQuery",
            series: [
              { id: "1", name: "First page view", type: "events", event: "$pageview" },
              { id: "2", name: "Second page view", type: "events", event: "$pageview" },
              { id: "3", name: "Third page view", type: "events", event: "$pageview" },
            ],
            ...(dateFrom && { dateRange: { date_from: dateFrom } }),
          },
        }),
        runQuery({
          query: {
            kind: "TrendsQuery",
            series: [{ event: "$pageview", math: "total" }],
            breakdown: "$referring_domain",
            interval: "day",
            dateRange: { date_from: "-14d" },
          },
        }),
      ]);

      const extractTrend = (res: PromiseSettledResult<unknown>): TrendPoint[] => {
        if (res.status !== "fulfilled" || !res.value) return [];
        const v = res.value as Record<string, unknown>;
        const status = v.query_status as Record<string, unknown> | undefined;
        const rawResults = (status?.results ?? v.results ?? v.result) as unknown;
        const results = Array.isArray(rawResults) ? rawResults : [];
        const first = results[0];
        if (first == null) return [];
        if (Array.isArray(first)) {
          return (first as unknown[]).map((val: unknown, i: number) => ({
            value: Number(val) ?? 0,
            label: undefined,
          }));
        }
        if (typeof first === "object" && first !== null) {
          const obj = first as Record<string, unknown>;
          const data = obj.data ?? obj.values;
          const labels = obj.labels ?? obj.days ?? obj.dates;
          const arr = Array.isArray(data) ? data : [];
          const labs = Array.isArray(labels) ? labels : [];
          return arr.map((val: unknown, i: number) => ({
            value: Number(val) ?? 0,
            label: labs[i] != null ? String(labs[i]) : undefined,
          }));
        }
        return [];
      };

      setDauData(extractTrend(dauRes));
      setWauData(extractTrend(wauRes));

      let funnelFromQuery: FunnelStep[] = [];
      if (funnelRes.status === "fulfilled" && funnelRes.value) {
        const v = funnelRes.value as Record<string, unknown>;
        const status = v.query_status as Record<string, unknown> | undefined;
        const raw = (status?.results ?? v.results ?? v.steps ?? v) as unknown;
        const arr = Array.isArray(raw) ? raw : [];
        funnelFromQuery = arr.map((s: unknown, i: number) => {
          const step = s as Record<string, unknown>;
          const count = Number(step.count ?? step.converted_count ?? step.convertedCount ?? 0);
          const prev = i > 0 ? (arr[i - 1] as Record<string, unknown>) : null;
          const prevCount = prev ? Number(prev.count ?? prev.converted_count ?? prev.convertedCount ?? 0) : count;
          const dropOff = prevCount - count;
          const dropOffPct = prevCount > 0 ? (dropOff / prevCount) * 100 : 0;
          const time = step.average_conversion_time ?? step.averageConversionTime;
          return {
            count,
            label: String(step.name ?? step.label ?? step.custom_name ?? `Step ${i + 1}`),
            dropOff: i > 0 ? dropOff : undefined,
            dropOffPct: i > 0 ? dropOffPct : undefined,
            convertTime: time != null ? `${Number(time)}s` : undefined,
          };
        });
      }
      setFunnelData(funnelFromQuery);

      let referringFromQuery: { label: string; value: number }[] = [];
      if (referringRes.status === "fulfilled" && referringRes.value) {
        const v = referringRes.value as Record<string, unknown>;
        const status = v.query_status as Record<string, unknown> | undefined;
        const raw = (status?.results ?? v.results ?? v) as unknown;
        const series = Array.isArray(raw) ? raw : [];
        const byLabel: Record<string, number> = {};
        series.forEach((s: unknown) => {
          const item = s as Record<string, unknown>;
          const label = String(item.breakdown_value ?? item.breakdownValue ?? item.label ?? "$direct");
          const data = (item.data ?? item.values) as unknown[];
          const total = Array.isArray(data) ? data.reduce((a: number, n: unknown) => a + Number(n), 0) : Number(item.aggregated_value ?? item.count ?? 0);
          if (total > 0) byLabel[label] = (byLabel[label] ?? 0) + total;
        });
        referringFromQuery = Object.entries(byLabel)
          .map(([label, value]) => ({ label: label === "null" || !label ? "$direct" : label, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
      }
      setReferringData(referringFromQuery);

      // Fallback: derive referring and funnel from events when query API returns no data
      if (referringFromQuery.length === 0 || funnelFromQuery.length === 0) {
        try {
          const fallbackRes = await fetch(`/api/posthog/analytics-fallback?days=${period}`);
          if (fallbackRes.ok) {
            const fallback = (await fallbackRes.json()) as {
              referring?: { label: string; value: number }[];
              funnel?: { count: number; label: string }[];
            };
            if (referringFromQuery.length === 0 && Array.isArray(fallback.referring) && fallback.referring.length > 0) {
              setReferringData(fallback.referring);
            }
            if (funnelFromQuery.length === 0 && Array.isArray(fallback.funnel) && fallback.funnel.length > 0) {
              setFunnelData(
                fallback.funnel.map((step, i) => {
                  const prev = fallback.funnel![i - 1];
                  const prevCount = prev?.count ?? step.count;
                  const dropOff = prevCount - step.count;
                  const dropOffPct = prevCount > 0 ? (dropOff / prevCount) * 100 : 0;
                  return {
                    count: step.count,
                    label: step.label,
                    dropOff: i > 0 ? dropOff : undefined,
                    dropOffPct: i > 0 ? dropOffPct : undefined,
                  };
                })
              );
            }
          }
        } catch {
          // ignore fallback errors
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
      setDauData([]);
      setWauData([]);
      setFunnelData([]);
      setReferringData([]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const maxDau = Math.max(1, ...dauData.map((d) => d.value));
  const maxWau = Math.max(1, ...wauData.map((d) => d.value));
  const maxRefer = Math.max(1, ...referringData.map((d) => d.value));

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-primary/10 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <AnalyticsIcon className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold text-gray-900">Web Analytics</h1>
        </div>
          <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => load()}
            className="rounded-xl border border-primary/20 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-gray-50 hover:shadow-md"
          >
            Reload
          </button>
          <div className="flex items-center gap-2 rounded-xl border border-primary/10 bg-white/80 px-2 py-1 shadow-sm">
            <span className="text-sm text-gray-600">Period:</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "7" | "14" | "30" | "90")}
              className="rounded border-0 bg-transparent text-sm font-medium text-gray-900 focus:ring-0"
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium text-gray-900">{user?.firstName ?? user?.username ?? "User"}</p>
            <p className="text-gray-500">{user?.primaryEmailAddress?.emailAddress ?? ""}</p>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-gray-600">Loading analytics…</p>
            </div>
          </div>
        ) : (
          <div className="min-w-0 space-y-8">
            {/* DAU & WAU */}
            <div className="grid min-w-0 gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-primary/10 bg-white p-6 shadow-lg shadow-primary/5 min-w-0 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">Trends · Last {period}d</div>
                <h2 className="text-lg font-semibold text-gray-900">Daily active users (DAU)</h2>
                <p className="mt-0.5 text-sm text-gray-500">Unique users per day.</p>
                <div className="mt-4 min-w-0 overflow-x-auto pb-2">
                  <div
                    className="flex items-end gap-1"
                    style={{ minWidth: dauData.length > 0 ? Math.max(300, dauData.length * 32) : "auto" }}
                  >
                    {dauData.length === 0 ? (
                      <p className="w-full py-8 text-center text-sm text-gray-400">No data</p>
                    ) : (
                      dauData.map((d, i) => (
                        <div
                          key={i}
                          className="flex min-w-[28px] max-w-[48px] flex-1 shrink-0 flex-col items-center gap-1"
                          title={d.label ? `${d.label}: ${d.value}` : String(d.value)}
                        >
                          <div
                            className="w-full min-h-[6px] rounded-t bg-primary/80 transition hover:bg-primary"
                            style={{ height: `${Math.max(12, (d.value / maxDau) * 120)}px` }}
                          />
                          {d.label && (
                            <span className="w-full truncate text-center text-[10px] text-gray-400">
                              {d.label}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
              <section className="rounded-2xl border border-primary/10 bg-white p-6 shadow-lg shadow-primary/5 min-w-0 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">Trends · Last {period === "7" || period === "14" ? "30" : period}d</div>
                <h2 className="text-lg font-semibold text-gray-900">Weekly active users (WAU)</h2>
                <p className="mt-0.5 text-sm text-gray-500">Unique users per week.</p>
                <div className="mt-4 min-w-0 overflow-x-auto pb-2">
                  <div
                    className="flex items-end gap-1"
                    style={{ minWidth: wauData.length > 0 ? Math.max(300, wauData.length * 48) : "auto" }}
                  >
                    {wauData.length === 0 ? (
                      <p className="w-full py-8 text-center text-sm text-gray-400">No data</p>
                    ) : (
                      wauData.map((d, i) => (
                        <div
                          key={i}
                          className="flex min-w-[44px] max-w-[72px] flex-1 shrink-0 flex-col items-center gap-1"
                          title={d.label ? `${d.label}: ${d.value}` : String(d.value)}
                        >
                          <div
                            className="w-full min-h-[6px] rounded-t bg-primary/70 transition hover:bg-primary"
                            style={{ height: `${Math.max(12, (d.value / maxWau) * 120)}px` }}
                          />
                          {d.label && (
                            <span className="w-full truncate text-center text-[10px] text-gray-400">
                              {d.label}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Funnel */}
            <section className="rounded-2xl border border-primary/10 bg-white p-6 shadow-lg shadow-primary/5 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">Funnel · Last {period}d</div>
              <h2 className="text-lg font-semibold text-gray-900">Pageview funnel</h2>
              <p className="mt-0.5 text-sm text-gray-500">How many users completed 3 page views.</p>
              <div className="mt-4 space-y-4">
                {funnelData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">No funnel data</p>
                ) : (
                  funnelData.map((step, i) => (
                    <div key={i} className="rounded-xl border border-primary/5 bg-white/80 p-4 shadow-sm transition hover:border-primary/15 hover:shadow-md">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{step.label ?? `Step ${i + 1}`}</span>
                        <span className="text-gray-600">→ {step.count} persons</span>
                      </div>
                      {step.convertTime && (
                        <p className="mt-1 text-xs text-gray-500">Average time to convert: {step.convertTime}</p>
                      )}
                      {step.dropOff != null && step.dropOffPct != null && (
                        <p className="mt-1 text-xs text-amber-600">
                          ↘ {step.dropOff} persons ({step.dropOffPct.toFixed(1)}%) dropped off
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Referring domains */}
            <section className="rounded-2xl border border-primary/10 bg-white p-6 shadow-lg shadow-primary/5 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">Trends · Last 14 days</div>
              <h2 className="text-lg font-semibold text-gray-900">Referring domain</h2>
              <p className="mt-0.5 text-sm text-gray-500">Most common referring domains for your users.</p>
              <div className="mt-4 space-y-3">
                {referringData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">No referring data</p>
                ) : (
                  referringData.map((d, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-48 truncate text-sm text-gray-700" title={d.label}>
                        {d.label}
                      </span>
                      <div className="flex-1 overflow-hidden rounded bg-gray-100">
                        <div
                          className="h-6 rounded bg-primary/80 transition"
                          style={{ width: `${Math.min(100, (d.value / maxRefer) * 100)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-sm font-medium text-gray-700">{d.value}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
