import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { posthogEvents } from "@/lib/db/schema";
import { VectorSyncService } from "@/lib/vector-sync.service";
import { and, desc, eq } from "drizzle-orm";

/** Raw event from PostHog API (results[]. */
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

function rawToRow(raw: PostHogEventRaw): {
  posthogEventId: string;
  eventName: string;
  distinctId: string | null;
  timestamp: Date;
  url: string | null;
  elementTag: string | null;
  elementText: string | null;
  sessionId: string | null;
  properties: Record<string, unknown> | null;
} {
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

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return Response.json({ events: [] }, { status: 200 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
    const eventName = searchParams.get("event");
    const distinctId = searchParams.get("distinct_id");

    const conditions = [];
    if (eventName) conditions.push(eq(posthogEvents.eventName, eventName));
    if (distinctId) conditions.push(eq(posthogEvents.distinctId, distinctId));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const list = await db
      .select()
      .from(posthogEvents)
      .where(whereClause)
      .orderBy(desc(posthogEvents.timestamp))
      .limit(limit)
      .offset(offset);
    return Response.json({ events: list });
  } catch (e) {
    console.error("GET /api/db/events error:", e);
    return Response.json({ events: [] }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false }, { status: 503 });
  }
  try {
    const body = await request.json();
    const rawList = Array.isArray(body.events) ? (body.events as PostHogEventRaw[]) : [];
    if (rawList.length === 0) return Response.json({ ok: true, inserted: 0 });

    const rows = rawList.map((raw) => rawToRow(raw));
    await db
      .insert(posthogEvents)
      .values(rows)
      .onConflictDoNothing({ target: posthogEvents.posthogEventId });

    VectorSyncService.syncPosthogEvents(rows).catch(() => {});

    return Response.json({ ok: true, inserted: rows.length });
  } catch (e) {
    console.error("POST /api/db/events error:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
