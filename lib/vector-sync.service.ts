/**
 * VectorSyncService – syncs Neon (PostgreSQL) data to ChromaDB for vector search and LLM context.
 * Neon is the source of truth; ChromaDB stores embeddings for semantic search.
 *
 * Flow:
 * 1. Ingestion: When data is written to Neon (API routes), call sync*() with the new rows.
 * 2. Manual sync: GET /api/db/sync-to-chroma or npm run vector:sync → syncAll().
 * 3. Auto-sync: GET /api/cron/vector-sync (e.g. Vercel Cron every 10 min) → syncAll().
 */

import { addToChroma, type ChromaDoc } from "@/lib/chroma";
import { db } from "@/lib/db";
import {
  issues as issuesTable,
  logs as logsTable,
  monitoring as monitoringTable,
  posthogEvents as posthogEventsTable,
} from "@/lib/db/schema";
import type { MonitoringRow, PosthogEventRow } from "@/lib/db/schema";

const BATCH = 100;

/** Monitoring row shape (from Neon or from ingestion payload). */
type MonitoringLike = Pick<
  MonitoringRow,
  "recordingId" | "distinctId" | "recordingDuration" | "startTime" | "clickCount" | "consoleErrorCount" | "rageClickCount" | "deadClickCount" | "startUrl"
>;

/** Issue row shape (from Neon or ingestion). id is set when syncing from DB (syncAll). */
type IssueLike = {
  id?: string;
  recordingId: string;
  title: string;
  description: string;
  severity: string;
  codeLocation: string;
  suggestedFix?: string | null;
  status?: string;
};

/** Log row shape or ingestion body. */
type LogLike = {
  id?: string;
  recordingId: string;
  title: string;
  description: string;
  severity: string;
  suggestedFix: string;
  developerRating?: number | null;
  agentConfidenceScore?: string | number | null;
};

/** PostHog event row shape. */
type PosthogEventLike = Pick<
  PosthogEventRow,
  "posthogEventId" | "eventName" | "distinctId" | "timestamp" | "url" | "elementTag" | "elementText"
>;

export const VectorSyncService = {
  /** Sync monitoring rows to Chroma (call after saving to Neon). */
  async syncMonitoring(rows: MonitoringLike[]): Promise<void> {
    if (rows.length === 0) return;
    const docs: ChromaDoc[] = rows.map((r) => ({
      id: r.recordingId,
      document: JSON.stringify({
        recordingId: r.recordingId,
        distinctId: r.distinctId,
        recordingDuration: r.recordingDuration,
        startTime: r.startTime,
        clickCount: r.clickCount,
        consoleErrorCount: r.consoleErrorCount,
        rageClickCount: r.rageClickCount,
        deadClickCount: r.deadClickCount,
        startUrl: r.startUrl,
      }),
      metadata: { recordingId: r.recordingId, table: "monitoring" },
    }));
    await addToChroma("monitoring", docs);
  },

  /** Sync issues to Chroma (call after saving to Neon). Use row.id when present (from DB), else recordingId. */
  async syncIssues(rows: IssueLike[]): Promise<void> {
    if (rows.length === 0) return;
    const docs: ChromaDoc[] = rows.map((r) => ({
      id: r.id ?? r.recordingId,
      document: JSON.stringify({
        recordingId: r.recordingId,
        title: r.title,
        description: r.description,
        severity: r.severity,
        codeLocation: r.codeLocation,
        suggestedFix: r.suggestedFix,
        status: r.status,
      }),
      metadata: { recordingId: r.recordingId, table: "issues", severity: r.severity, title: r.title },
    }));
    await addToChroma("issues", docs);
  },

  /** Sync logs to Chroma (call after saving to Neon). */
  async syncLogs(rows: LogLike[]): Promise<void> {
    if (rows.length === 0) return;
    const docs: ChromaDoc[] = rows.map((r, i) => ({
      id: r.id ? `${r.recordingId}-${r.id}` : `${r.recordingId}-${Date.now()}-${i}`,
      document: JSON.stringify({
        recordingId: r.recordingId,
        title: r.title,
        description: r.description,
        severity: r.severity,
        suggestedFix: r.suggestedFix,
        developerRating: r.developerRating,
        agentConfidenceScore: r.agentConfidenceScore,
      }),
      metadata: { recordingId: r.recordingId, table: "logs", severity: r.severity, title: r.title },
    }));
    await addToChroma("logs", docs);
  },

  /** Sync PostHog events to Chroma (call after saving to Neon). */
  async syncPosthogEvents(rows: PosthogEventLike[]): Promise<void> {
    if (rows.length === 0) return;
    const docs: ChromaDoc[] = rows.map((r) => ({
      id: r.posthogEventId,
      document: JSON.stringify({
        eventName: r.eventName,
        url: r.url,
        elementTag: r.elementTag,
        elementText: r.elementText,
        timestamp: r.timestamp,
        distinctId: r.distinctId,
      }),
      metadata: { posthogEventId: r.posthogEventId, table: "posthog_events", eventName: r.eventName },
    }));
    await addToChroma("posthog_events", docs);
  },

  /**
   * Read all data from Neon and sync to Chroma. Use for manual backfill or auto-sync (cron).
   */
  async syncAll(): Promise<{ monitoring: number; issues: number; logs: number; posthog_events: number }> {
    const monitoringRows = await db.select().from(monitoringTable);
    for (let i = 0; i < monitoringRows.length; i += BATCH) {
      await VectorSyncService.syncMonitoring(monitoringRows.slice(i, i + BATCH));
    }

    const issuesRows = await db.select().from(issuesTable);
    for (let i = 0; i < issuesRows.length; i += BATCH) {
      await VectorSyncService.syncIssues(issuesRows.slice(i, i + BATCH));
    }

    const logsRows = await db.select().from(logsTable);
    for (let i = 0; i < logsRows.length; i += BATCH) {
      await VectorSyncService.syncLogs(logsRows.slice(i, i + BATCH));
    }

    const eventsRows = await db.select().from(posthogEventsTable);
    for (let i = 0; i < eventsRows.length; i += BATCH) {
      await VectorSyncService.syncPosthogEvents(eventsRows.slice(i, i + BATCH));
    }

    return {
      monitoring: monitoringRows.length,
      issues: issuesRows.length,
      logs: logsRows.length,
      posthog_events: eventsRows.length,
    };
  },
};
