import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { posthogEvents } from "@/lib/db/schema";
import { posthogGet } from "@/lib/posthog-api";
import { VectorSyncService } from "@/lib/vector-sync.service";

export const dynamic = "force-dynamic";

type PostHogEventRaw = {
  id?: string;
  distinct_id?: string;
  event?: string;
  timestamp?: string;
  properties?: string | Record<string, unknown>;
  elements?: string | unknown[];
  elements_chain?: string;
  person?: unknown;
};

function parseProperties(properties: string | Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (properties == null) return null;
  if (typeof properties === "object") return properties;
  try {
    return JSON.parse(properties) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeUrl(properties: Record<string, unknown> | null): string | null {
  if (!properties) return null;
  const u =
    (properties.$current_url as string) ??
    (properties.current_url as string) ??
    (properties.$pathname as string) ??
    (properties.pathname as string);
  return typeof u === "string" ? u : null;
}

function normalizeElement(properties: Record<string, unknown> | null, elements: unknown): { tag?: string; text?: string } {
  const out: { tag?: string; text?: string } = {};
  if (properties) {
    const tag = (properties.$el_tag_name as string) ?? (properties.tag_name as string);
    const text = (properties.$el_text as string) ?? (properties.el_text as string) ?? (properties.text as string);
    if (tag) out.tag = tag;
    if (text) out.text = text;
  }
  if (elements && Array.isArray(elements) && elements.length > 0) {
    const first = elements[0] as Record<string, unknown> | undefined;
    if (first) {
      if (!out.tag && first.tag_name) out.tag = String(first.tag_name);
      if (!out.text && first.text) out.text = String(first.text);
    }
  }
  return out;
}

function rawToRow(raw: PostHogEventRaw) {
  const id = raw.id ?? crypto.randomUUID();
  const props = parseProperties(raw.properties);
  const el = normalizeElement(props, raw.elements ?? null);
  const url = normalizeUrl(props);
  const sessionId = props?.$session_id != null ? String(props.$session_id) : null;
  return {
    posthogEventId: id,
    eventName: (raw.event as string) ?? "$unknown",
    distinctId: raw.distinct_id != null ? String(raw.distinct_id) : null,
    timestamp: raw.timestamp ? new Date(raw.timestamp) : new Date(),
    url,
    elementTag: el.tag ?? null,
    elementText: el.text ?? null,
    sessionId,
    properties: props,
  };
}

const PAGE_SIZE = 100;
const MAX_OFFSET = 50_000;

type PostHogEventsResponse = {
  results?: PostHogEventRaw[];
  next?: string;
};

/** Sync all PostHog events (paginated) into Neon. Only new events are inserted (by posthog_event_id). */
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false, message: "DATABASE_URL not set" }, { status: 503 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const after = searchParams.get("after");
    const before = searchParams.get("before");
    let totalSynced = 0;
    let offset = 0;

    while (offset < MAX_OFFSET) {
      const params: Record<string, string> = {
        limit: String(PAGE_SIZE),
        offset: String(offset),
      };
      if (after) params.after = after;
      if (before) params.before = before;

      const data = await posthogGet<PostHogEventsResponse>("/events/", params);
      const rawList = Array.isArray(data?.results) ? data.results : [];
      if (rawList.length === 0) break;

      const rows = rawList.map((raw) => rawToRow(raw));
      await db
        .insert(posthogEvents)
        .values(rows)
        .onConflictDoNothing({ target: posthogEvents.posthogEventId });
      VectorSyncService.syncPosthogEvents(rows).catch(() => {});
      totalSynced += rawList.length;
      if (rawList.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return Response.json({ ok: true, synced: totalSynced });
  } catch (e) {
    console.error("GET /api/db/events/sync error:", e);
    const message = e instanceof Error ? e.message : "Sync failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
