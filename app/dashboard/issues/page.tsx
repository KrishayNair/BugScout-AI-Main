"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";

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

type Severity = "Critical" | "High" | "Medium" | "Low";

type IssueFromRecording = {
  recordingId: string;
  recording: Recording;
  title: string;
  description: string;
  suggestedFix?: string;
  codeLocation?: string;
  codeSnippetHint?: string;
  posthogCategoryId?: string;
  posthogIssueTypeId?: string;
  severity: Severity;
  instances: number;
  timeAgo: string;
  firstDetected: string;
  status: string;
  approved?: boolean;
  approvedRating?: number;
};

function severityClass(severity: Severity): string {
  switch (severity) {
    case "Critical":
      return "bg-red-100 text-red-700";
    case "High":
      return "bg-orange-100 text-orange-700";
    case "Medium":
      return "bg-amber-100 text-amber-700";
    case "Low":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

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

function formatTimeFaced(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

type LoadingStep = "recordings" | "analyzing" | "suggesting" | null;

export default function IssuesPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState<LoadingStep>("recordings");
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<IssueFromRecording[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replayEmbedUrl, setReplayEmbedUrl] = useState<string | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [showRatingForId, setShowRatingForId] = useState<string | null>(null);
  const [ratingForId, setRatingForId] = useState<Record<string, number>>({});
  const [showReviseForId, setShowReviseForId] = useState<string | null>(null);
  const [reviseInstructions, setReviseInstructions] = useState("");
  const [reviseLoading, setReviseLoading] = useState(false);
  const loadInProgressRef = useRef(false);

  type StatusFilter = "unresolved" | "all" | "resolved";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("unresolved");

  const filteredIssues =
    statusFilter === "unresolved"
      ? issues.filter((i) => i.status !== "Resolved")
      : statusFilter === "resolved"
        ? issues.filter((i) => i.status === "Resolved")
        : issues;

  const selected =
    filteredIssues.find((i) => i.recordingId === selectedId) ??
    filteredIssues[0] ??
    issues.find((i) => i.recordingId === selectedId) ??
    issues[0] ??
    null;

  const handleApproveSubmit = useCallback(
    async (issue: IssueFromRecording, rating: number) => {
      if (rating < 1 || rating > 5) return;
      try {
        const [logRes, patchRes] = await Promise.all([
          fetch("/api/db/logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recordingId: issue.recordingId,
              title: issue.title,
              description: issue.description,
              severity: issue.severity,
              suggestedFix: issue.suggestedFix ?? "",
              developerRating: rating,
            }),
          }),
          fetch(`/api/db/issues/${encodeURIComponent(issue.recordingId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              approved: true,
              approvedRating: rating,
              approvedAt: new Date().toISOString(),
            }),
          }),
        ]);
        if (!logRes.ok && patchRes.ok) {
          await fetch("/api/issues/log-approval", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recordingId: issue.recordingId,
              title: issue.title,
              suggestedFix: issue.suggestedFix,
              rating,
            }),
          });
        }
        setIssues((prev) =>
          prev.map((i) =>
            i.recordingId === issue.recordingId ? { ...i, approved: true, approvedRating: rating } : i
          )
        );
        setShowRatingForId(null);
        setRatingForId((r) => ({ ...r, [issue.recordingId]: rating }));
      } catch {
        // ignore
      }
    },
    []
  );

  const handleReviseSubmit = useCallback(
    async (issue: IssueFromRecording) => {
      if (!reviseInstructions.trim() || reviseLoading) return;
      setReviseLoading(true);
      try {
        const monitoredIssue = {
          recordingId: issue.recordingId,
          posthogCategoryId: issue.posthogCategoryId ?? "ux",
          posthogIssueTypeId: issue.posthogIssueTypeId ?? "rage-frustration",
          title: issue.title,
          description: issue.description,
          severity: issue.severity,
          codeLocation: issue.codeLocation ?? "",
          codeSnippetHint: issue.codeSnippetHint,
          startUrl: issue.recording?.start_url,
        };
        const res = await fetch("/api/issues/suggest-fix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issues: [monitoredIssue],
            revisionInstructions: reviseInstructions.trim(),
            previousSuggestedFix: issue.suggestedFix,
          }),
        });
        const data = await res.json();
        const fixes = Array.isArray(data?.suggestedFixes) ? data.suggestedFixes : [];
        const fix = fixes.find((f: { recordingId: string }) => f.recordingId === issue.recordingId);
        if (fix?.suggestedFix) {
          try {
            await fetch(`/api/db/issues/${encodeURIComponent(issue.recordingId)}/revisions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                instruction: reviseInstructions.trim(),
                suggestedFixAfter: fix.suggestedFix,
              }),
            });
            await fetch(`/api/db/issues/${encodeURIComponent(issue.recordingId)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ suggestedFix: fix.suggestedFix }),
            });
          } catch {
            // ignore
          }
          setIssues((prev) =>
            prev.map((i) =>
              i.recordingId === issue.recordingId ? { ...i, suggestedFix: fix.suggestedFix } : i
            )
          );
          setShowReviseForId(null);
          setReviseInstructions("");
        }
      } catch {
        // ignore
      } finally {
        setReviseLoading(false);
      }
    },
    [reviseInstructions, reviseLoading]
  );

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
        // Sync error events first so $exception / rage / dead-click create issues and trigger emails even when not in top recordings
        const syncController = new AbortController();
        const syncTimeout = setTimeout(() => syncController.abort(), 15000);
        fetch("/api/sync/error-events", { signal: syncController.signal })
          .then(() => clearTimeout(syncTimeout))
          .catch(() => clearTimeout(syncTimeout));

        const recRes = await fetch(`/api/posthog/session-recordings?limit=150&date_from=-7d&${t}`);
        if (!recRes.ok) {
          setError("Failed to load session recordings");
          loadInProgressRef.current = false;
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

        try {
          await fetch("/api/db/monitoring", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recordings: list }),
          });
        } catch {
          // ignore
        }

        // Sessions with issue events (exceptions, rage/dead clicks) — fetch so we don't miss $exception-only sessions
        let sessionEventsForFilter: Record<string, unknown[]> = {};
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
          const evRes = await fetch("/api/posthog/session-events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recordings: payload }),
          });
          if (evRes.ok) {
            const evData = (await evRes.json()) as Record<string, unknown[]>;
            sessionEventsForFilter = evData ?? {};
          }
        } catch {
          // non-fatal
        }

        type DbIssue = {
          recordingId: string;
          title: string;
          description: string;
          severity: string;
          codeLocation?: string;
          codeSnippetHint?: string;
          posthogCategoryId?: string;
          posthogIssueTypeId?: string;
          suggestedFix?: string | null;
          status?: string;
          approved?: boolean;
          approvedRating?: number | null;
        };

        const toIssueFromRecording = (rec: Recording, d: DbIssue): IssueFromRecording => ({
          recordingId: d.recordingId,
          recording: rec,
          title: d.title,
          description: d.description,
          suggestedFix: d.suggestedFix ?? undefined,
          codeLocation: d.codeLocation,
          codeSnippetHint: d.codeSnippetHint,
          posthogCategoryId: d.posthogCategoryId,
          posthogIssueTypeId: d.posthogIssueTypeId,
          severity: (["Critical", "High", "Medium", "Low"].includes(d.severity) ? d.severity : "Medium") as Severity,
          instances: 1,
          timeAgo: formatTimeAgo(rec.start_time),
          firstDetected: formatFirstDetected(rec.start_time),
          status: d.status === "Resolved" ? "Resolved" : "Unresolved",
          approved: d.approved,
          approvedRating: d.approvedRating ?? undefined,
        });

        const hasIssuesFromCounts = (r: Recording) =>
          (r.console_error_count != null && r.console_error_count > 0) ||
          (r.rage_click_count != null && r.rage_click_count > 0) ||
          (r.dead_click_count != null && r.dead_click_count > 0);
        const hasIssuesFromEvents = (r: Recording) => (sessionEventsForFilter[r.id]?.length ?? 0) > 0;
        const withErrors = list.filter(
          (r) => hasIssuesFromCounts(r) || hasIssuesFromEvents(r)
        );

        if (cancelled) {
          setLoadingStep(null);
          setLoading(false);
          loadInProgressRef.current = false;
          return;
        }
        if (withErrors.length === 0) {
          // Still show event-only issues from DB (from sync/error-events)
          const EVENT_ISSUE_PREFIX = "evt-";
          try {
            const dbRes0 = await fetch("/api/db/issues");
            const dbData0 = await dbRes0.json();
            const dbList = Array.isArray(dbData0?.issues) ? dbData0.issues : [];
            const eventOnly = dbList.filter((i: { recordingId?: string }) => i.recordingId?.startsWith(EVENT_ISSUE_PREFIX));
            if (eventOnly.length > 0 && !cancelled) {
              const synthetic: IssueFromRecording[] = eventOnly.map((d: DbIssue & { createdAt?: string }) => {
                const rec: Recording = {
                  id: d.recordingId,
                  start_time: d.createdAt,
                  start_url: d.startUrl ?? undefined,
                };
                return toIssueFromRecording(rec, { ...d, status: d.status ?? "Unresolved" });
              });
              setIssues(synthetic);
              setSelectedId(synthetic[0]?.recordingId ?? null);
            } else if (!cancelled) {
              setIssues([]);
              setSelectedId(null);
            }
          } catch {
            if (!cancelled) setIssues([]), setSelectedId(null);
          }
          setLoadingStep(null);
          setLoading(false);
          loadInProgressRef.current = false;
          return;
        }

        let dbIssues: DbIssue[] = [];
        try {
          const dbRes = await fetch("/api/db/issues");
          const dbData = await dbRes.json();
          dbIssues = Array.isArray(dbData?.issues) ? dbData.issues : [];
        } catch {
          // ignore; we will run analyze for all
        }

        const existingByRecId = new Map<string, DbIssue>(
          dbIssues.filter((d) => withErrors.some((r) => r.id === d.recordingId)).map((d) => [d.recordingId, d])
        );
        const newRecordings = withErrors.filter((r) => !existingByRecId.has(r.id));

        if (newRecordings.length === 0 && existingByRecId.size > 0) {
          const fromDb: IssueFromRecording[] = Array.from(existingByRecId.entries()).map(([recordingId, d]) => {
            const rec = withErrors.find((r) => r.id === recordingId)!;
            return toIssueFromRecording(rec, d);
          });
          if (!cancelled) {
            setIssues(fromDb);
            setSelectedId(fromDb[0]?.recordingId ?? null);
          }
          setLoadingStep(null);
          setLoading(false);
          loadInProgressRef.current = false;
          return;
        }

        let built: IssueFromRecording[] = [];
        if (newRecordings.length > 0) {
          setLoadingStep("analyzing");
          const summaries = newRecordings.map((r) => ({
            recordingId: r.id,
            consoleErrorCount: r.console_error_count ?? 0,
            clickCount: r.click_count ?? 0,
            rageClickCount: r.rage_click_count,
            deadClickCount: r.dead_click_count,
            durationSeconds: r.recording_duration,
            startUrl: r.start_url,
            startTime: r.start_time,
          }));

          let sessionEvents: Record<string, Array<{ event: string; timestamp?: string; message?: string; type?: string; url?: string; element?: string; selector?: string }>> = {};
          try {
            const payload = newRecordings.map((r) => {
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
            const evRes = await fetch("/api/posthog/session-events", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ recordings: payload }),
            });
            if (evRes.ok) {
              const evData = await evRes.json();
              sessionEvents = evData ?? {};
            }
          } catch {
            // non-fatal; analyze will use counts only
          }

          const analyzeRes = await fetch("/api/issues/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recordings: summaries, sessionEvents }),
          });
          const analyzeData = await analyzeRes.json();
          const monitoredIssues = Array.isArray(analyzeData?.issues) ? analyzeData.issues : [];

          let suggestedFixes: Array<{ recordingId: string; suggestedFix: string; codeLocation: string }> = [];
          if (monitoredIssues.length > 0 && !cancelled) {
            setLoadingStep("suggesting");
            try {
              const fixRes = await fetch("/api/issues/suggest-fix", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ issues: monitoredIssues }),
              });
              const fixData = await fixRes.json();
              suggestedFixes = Array.isArray(fixData?.suggestedFixes) ? fixData.suggestedFixes : [];
            } catch {
              // non-fatal
            }
          }

          built = newRecordings.map((rec) => {
            const a = monitoredIssues.find((x: { recordingId: string }) => x.recordingId === rec.id) as
              | {
                  recordingId: string;
                  title?: string;
                  description?: string;
                  codeLocation?: string;
                  codeSnippetHint?: string;
                  posthogCategoryId?: string;
                  posthogIssueTypeId?: string;
                  severity?: string;
                }
              | undefined;
            const fix = suggestedFixes.find((f) => f.recordingId === rec.id);
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
              suggestedFix: fix?.suggestedFix,
              codeLocation: a?.codeLocation ?? fix?.codeLocation,
              codeSnippetHint: a?.codeSnippetHint,
              posthogCategoryId: a?.posthogCategoryId,
              posthogIssueTypeId: a?.posthogIssueTypeId,
              severity: (a?.severity && ["Critical", "High", "Medium", "Low"].includes(a.severity) ? a.severity : "Medium") as Severity,
              instances: 1,
              timeAgo: formatTimeAgo(rec.start_time),
              firstDetected: formatFirstDetected(rec.start_time),
              status: "Unresolved",
            };
          });

          try {
            await fetch("/api/db/issues", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                issues: built.map((b) => {
                  const timeFaced = b.recording?.start_time
                    ? new Date(b.recording.start_time).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
                    : "see events";
                  const prefix = `Session ID: ${b.recordingId}. Time faced: ${timeFaced}.\n\n`;
                  const description =
                    (b.description ?? "").trim().startsWith("Session ID:") ? b.description : prefix + (b.description ?? "");
                  return {
                    recordingId: b.recordingId,
                    posthogCategoryId: b.posthogCategoryId ?? "ux",
                    posthogIssueTypeId: b.posthogIssueTypeId ?? "rage-frustration",
                    title: b.title,
                    description,
                    severity: b.severity,
                    codeLocation: b.codeLocation ?? "",
                    codeSnippetHint: b.codeSnippetHint,
                    startUrl: b.recording?.start_url,
                    suggestedFix: b.suggestedFix,
                  };
                }),
              }),
            });
          } catch {
            // ignore
          }
        }

        const EVENT_ISSUE_PREFIX = "evt-";
        const existingIssues: IssueFromRecording[] = Array.from(existingByRecId.entries()).map(([recordingId, d]) => {
          const rec = withErrors.find((r) => r.id === recordingId)!;
          return toIssueFromRecording(rec, d);
        });

        let merged = [...existingIssues, ...built];
        try {
          const dbRes2 = await fetch("/api/db/issues");
          const dbData2 = await dbRes2.json();
          const dbIssues2 = Array.isArray(dbData2?.issues) ? dbData2.issues : [];
          const byRec = Object.fromEntries(
            dbIssues2.map((i: DbIssue) => [i.recordingId, i])
          );
          merged = merged.map((b) => {
            const d = byRec[b.recordingId];
            if (!d) return b;
            return {
              ...b,
              status: (d.status === "Resolved" ? "Resolved" : b.status) as "Unresolved" | "Resolved",
              approved: d.approved ?? b.approved,
              approvedRating: d.approvedRating ?? b.approvedRating,
            };
          });
          // Add event-only issues (from sync/error-events) that aren't in the recordings list
          const mergedIds = new Set(merged.map((m) => m.recordingId));
          for (const d of dbIssues2) {
            if (!d.recordingId?.startsWith(EVENT_ISSUE_PREFIX) || mergedIds.has(d.recordingId)) continue;
            const syntheticRec: Recording = {
              id: d.recordingId,
              start_time: (d as DbIssue & { createdAt?: string }).createdAt,
              start_url: d.startUrl ?? undefined,
            };
            merged.push(
              toIssueFromRecording(syntheticRec, {
                ...d,
                status: d.status ?? "Unresolved",
              })
            );
            mergedIds.add(d.recordingId);
          }
        } catch {
          // ignore
        }

        if (!cancelled) {
          setIssues(merged);
          setSelectedId(merged[0]?.recordingId ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load issues");
      } finally {
        if (!cancelled) {
          setLoadingStep(null);
          setLoading(false);
        }
        loadInProgressRef.current = false;
      }
    }

    load();
    return () => {
      cancelled = true;
      loadInProgressRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!selected?.recordingId) return;
    // Event-only issues (from sync/error-events) have no session replay
    if (selected.recordingId.startsWith("evt-")) {
      setReplayEmbedUrl(null);
      setReplayError(null);
      return;
    }
    loadReplay(selected.recordingId);
  }, [selected?.recordingId, loadReplay]);

  const markResolved = useCallback(async (issue: IssueFromRecording) => {
    try {
      await fetch(`/api/db/issues/${encodeURIComponent(issue.recordingId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Resolved" }),
      });
    } catch {
      // ignore
    }
    setIssues((prev) =>
      prev.map((i) => (i.recordingId === issue.recordingId ? { ...i, status: "Resolved" as const } : i))
    );
  }, []);

  const unresolvedCount = issues.filter((i) => i.status !== "Resolved").length;
  const resolvedCount = issues.filter((i) => i.status === "Resolved").length;
  const filters: { key: StatusFilter; label: string; count: number }[] = [
    { key: "unresolved", label: "Unresolved", count: unresolvedCount },
    { key: "all", label: "All", count: issues.length },
    { key: "resolved", label: "Resolved", count: resolvedCount },
  ];

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-primary/10 bg-white px-6 py-4 shadow-sm">
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
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {loadingStep === "recordings" && "Loading session recordings…"}
                {loadingStep === "analyzing" && "Issue monitoring agent analyzing…"}
                {loadingStep === "suggesting" && "Solution agent suggesting fixes…"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                This may take a minute. Please wait until both agents finish.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          <WarningIcon className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold text-gray-900">Issues</h1>
        </div>
        <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
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

        {issues.length === 0 && !error && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-primary/10 bg-white p-8 shadow-lg shadow-primary/5">
            <p className="text-gray-500">No issues from session recordings. Recordings with console errors will appear here.</p>
          </div>
        )}

        {issues.length > 0 && filteredIssues.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-primary/10 bg-white p-8 shadow-lg shadow-primary/5">
            <p className="text-gray-500">
              {statusFilter === "unresolved"
                ? "No unresolved issues."
                : statusFilter === "resolved"
                  ? "No resolved issues."
                  : "No issues match the current filter."}
            </p>
          </div>
        )}

        {issues.length > 0 && filteredIssues.length > 0 && selected && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{selected.title}</h2>
              <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                <span className={`rounded px-2 py-0.5 font-medium ${severityClass(selected.severity)}`}>
                  {selected.severity}
                </span>
                <span>First detected {selected.firstDetected}</span>
                <span>
                  {selected.recordingId.startsWith("evt-")
                    ? "Error event (no replay)"
                    : [
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
                    key={f.key}
                    type="button"
                    onClick={() => {
                      setStatusFilter(f.key);
                      const nextFiltered =
                        f.key === "unresolved"
                          ? issues.filter((i) => i.status !== "Resolved")
                          : f.key === "resolved"
                            ? issues.filter((i) => i.status === "Resolved")
                            : issues;
                      const currentSelectedInNext = nextFiltered.some((i) => i.recordingId === selectedId);
                      if (!currentSelectedInNext && nextFiltered.length > 0) {
                        setSelectedId(nextFiltered[0].recordingId);
                      }
                    }}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition ${
                      statusFilter === f.key
                        ? "border-red-500 bg-red-50 text-red-600"
                        : "border-primary/20 text-gray-600 hover:bg-primary/5 hover:border-primary/30"
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
                  Issues ({filteredIssues.length})
                </h3>
                <div className="flex flex-col gap-2 overflow-y-auto">
                  {filteredIssues.map((issue) => (
                    <button
                      key={issue.recordingId}
                      type="button"
                      onClick={() => setSelectedId(issue.recordingId)}
                    className={`rounded-2xl border p-4 text-left shadow-sm transition-all duration-200 ${
                      selectedId === issue.recordingId
                        ? "border-primary bg-primary/5 shadow-primary/10 ring-1 ring-primary/20"
                        : "border-primary/10 bg-white hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md"
                    }`}
                    >
                      <p className="font-medium text-gray-900">{issue.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className={`rounded px-1.5 py-0.5 font-medium ${severityClass(issue.severity)}`}>
                          {issue.severity}
                        </span>
                        <span>
                          {[
                            (issue.recording.console_error_count ?? 0) > 0 && `${issue.recording.console_error_count} err`,
                            (issue.recording.rage_click_count ?? 0) > 0 && `${issue.recording.rage_click_count} rage`,
                            (issue.recording.dead_click_count ?? 0) > 0 && `${issue.recording.dead_click_count} dead`,
                          ].filter(Boolean).join(", ")}
                        </span>
                        <span>{issue.timeAgo}</span>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-gray-500" title={issue.recordingId}>
                        Session: {issue.recordingId.startsWith("evt-") ? issue.recordingId.slice(0, 12) + "…" : issue.recordingId.slice(0, 8) + "…"} · {issue.firstDetected}
                      </p>
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
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    <p className="font-medium text-gray-700">
                      Session ID: <span className="font-mono text-gray-900">{selected.recordingId}</span>
                    </p>
                    <p className="mt-1 font-medium text-gray-700">
                      Time faced: <span className="text-gray-900">{formatTimeFaced(selected.recording.start_time)}</span>
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-sm font-medium ${
                        selected.status === "Resolved" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {selected.status}
                    </span>
                    {selected.status !== "Resolved" && (
                      <button
                        type="button"
                        onClick={() => markResolved(selected)}
                        className="rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-white shadow-md shadow-primary/25 transition hover:bg-primary-dark hover:shadow-lg"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-gray-600">{selected.description}</p>
                  {(selected.codeLocation || selected.codeSnippetHint) && (
                    <div className="mt-4 space-y-2">
                      {selected.codeLocation && (
                        <div className="rounded-xl border border-primary/10 bg-gray-50 px-3 py-2">
                          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                            Where in the code
                          </p>
                          <p className="mt-1 font-mono text-sm text-gray-800">{selected.codeLocation}</p>
                        </div>
                      )}
                      {selected.codeSnippetHint && (
                        <div className="rounded-lg border border-gray-200 bg-amber-50/80 px-3 py-2">
                          <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
                            Code hint
                          </p>
                          <p className="mt-1 text-sm text-gray-700">{selected.codeSnippetHint}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {selected.suggestedFix && (
                    <>
                      <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-wider text-green-700">
                          Suggested fix
                        </p>
                        <p className="mt-1 text-sm text-gray-700">{selected.suggestedFix}</p>
                      </div>
                      {selected.approved ? (
                        <div className="mt-3 text-sm text-gray-600">
                          Approved
                          {selected.approvedRating != null && (
                            <span className="ml-2 text-amber-600">
                              · {selected.approvedRating}/5
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowRatingForId(selected.recordingId);
                              setShowReviseForId(null);
                            }}
                            className="rounded-xl border border-green-600 bg-green-600 px-3 py-1.5 text-sm font-medium text-white shadow-md transition hover:bg-green-700 hover:shadow-lg"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowReviseForId(selected.recordingId);
                              setShowRatingForId(null);
                            }}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Revise
                          </button>
                        </div>
                      )}
                      {showRatingForId === selected.recordingId && (
                        <div className="mt-3 rounded-xl border border-primary/10 bg-gray-50 p-3">
                          <p className="text-xs font-medium text-gray-600">Rating (1–5)</p>
                          <div className="mt-2 flex gap-2">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setRatingForId((r) => ({ ...r, [selected.recordingId]: n }))}
                                className={`h-8 w-8 rounded border text-sm font-medium ${
                                  ratingForId[selected.recordingId] === n
                                    ? "border-primary bg-primary text-white"
                                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApproveSubmit(selected, ratingForId[selected.recordingId] ?? 0)}
                            disabled={!(ratingForId[selected.recordingId] >= 1 && ratingForId[selected.recordingId] <= 5)}
                            className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                          >
                            Submit
                          </button>
                        </div>
                      )}
                      {showReviseForId === selected.recordingId && (
                        <div className="mt-3 rounded-xl border border-primary/10 bg-gray-50 p-3">
                          <p className="text-xs font-medium text-gray-600">
                            Instructions to revise the suggested fix
                          </p>
                          <textarea
                            value={reviseInstructions}
                            onChange={(e) => setReviseInstructions(e.target.value)}
                            placeholder="e.g. Make the fix shorter, focus on error handling only..."
                            rows={3}
                            className="mt-2 w-full rounded-xl border border-primary/20 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary/30"
                          />
                          <button
                            type="button"
                            onClick={() => handleReviseSubmit(selected)}
                            disabled={!reviseInstructions.trim() || reviseLoading}
                            className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                          >
                            {reviseLoading ? "Regenerating…" : "Submit"}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </section>

                <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-lg shadow-primary/5 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
                  <div className="flex items-center gap-2">
                    <EyeIcon className="h-5 w-5 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">Related Session</h3>
                  </div>
                  <div className="mt-4">
                    <div className="overflow-hidden rounded-xl border border-primary/10 bg-gray-100">
                      <div className="aspect-video w-full min-h-[240px] bg-gray-200">
                        {replayLoading && (
                          <div className="flex h-full w-full items-center justify-center">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          </div>
                        )}
                        {selected.recordingId.startsWith("evt-") ? (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-gray-600">
                            <p>This issue was created from an error event ($exception, rage click, or dead click).</p>
                            <p>No session replay is linked for event-only issues.</p>
                          </div>
                        ) : (
                          <>
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
                          </>
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
