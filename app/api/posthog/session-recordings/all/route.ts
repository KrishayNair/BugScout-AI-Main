import { NextRequest } from "next/server";
import { posthogGet } from "@/lib/posthog-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE_SIZE = 100;
const MAX_SESSIONS_DEFAULT = 5000;

type PostHogRecording = Record<string, unknown>;
type ListResponse = { count?: number; next?: string; previous?: string; results?: PostHogRecording[] };

/**
 * Server-side "fetch all" session recordings from PostHog.
 * Paginates with limit/offset until no more pages (so you get all sessions, not just 10).
 * All requests are made from the backend; never expose the PostHog key to the frontend.
 *
 * GET /api/posthog/session-recordings/all?date_from=-7d&max=2000
 * Query params:
 *   - date_from: e.g. -7d, -30d (passed to PostHog if supported)
 *   - max: max total sessions to return (default 5000)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("date_from") ?? "-30d";
    const durationGt = searchParams.get("duration__gt"); // e.g. 60 for sessions longer than 60s
    const maxTotal = Math.min(
      Math.max(1, parseInt(searchParams.get("max") ?? String(MAX_SESSIONS_DEFAULT), 10)),
      10000
    );

    const allResults: PostHogRecording[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && allResults.length < maxTotal) {
      const params: Record<string, string> = {
        limit: String(PAGE_SIZE),
        offset: String(offset),
        date_from: dateFrom,
      };
      if (durationGt != null && durationGt !== "") params.duration__gt = durationGt;
      const data = await posthogGet<ListResponse>("/session_recordings/", params);
      const results = Array.isArray(data?.results) ? data.results : [];
      allResults.push(...results);

      if (results.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += results.length;
        if (offset >= maxTotal) hasMore = false;
      }
    }

    return Response.json({ results: allResults, count: allResults.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch sessions";
    console.error("session-recordings/all error:", e);
    return Response.json({ error: message, results: [], count: 0 }, { status: 500 });
  }
}
