import { NextRequest } from "next/server";
import { posthogGet } from "@/lib/posthog-api";

export const dynamic = "force-dynamic";

/** Fetch recent $pageview events and return referring-domain counts and a 3-step funnel. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") ?? "30", 10) || 30));
    const after = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const data = await posthogGet<{
      results?: Array<{
        distinct_id?: string;
        event?: string;
        timestamp?: string;
        properties?: Record<string, unknown> | string;
      }>;
    }>("/events/", { event: "$pageview", after, limit: "2000" });

    const rawResults =
      (data as Record<string, unknown>)?.results ??
      (data as Record<string, unknown>)?.data ??
      (Array.isArray(data) ? data : null);
    const results = Array.isArray(rawResults) ? rawResults : [];

    const getProps = (evt: (typeof results)[0]): Record<string, unknown> => {
      const p = evt.properties;
      if (p == null) return {};
      if (typeof p === "object") return p;
      if (typeof p === "string") {
        try {
          return (JSON.parse(p) as Record<string, unknown>) ?? {};
        } catch {
          return {};
        }
      }
      return {};
    };

    const referring: Record<string, number> = {};
    const pageviewsByUser: Record<string, number> = {};

    for (const evt of results) {
      const props = getProps(evt);
      const domain = (props["$referring_domain"] ?? props.referring_domain) as string | undefined;
      const label = domain && String(domain).trim() ? String(domain) : "$direct";
      referring[label] = (referring[label] ?? 0) + 1;

      const id = (evt.distinct_id ?? (props.distinct_id as string) ?? "").toString().trim();
      if (id) pageviewsByUser[id] = (pageviewsByUser[id] ?? 0) + 1;
    }

    const userIds = Object.keys(pageviewsByUser);
    const step1 = userIds.filter((id) => pageviewsByUser[id] >= 1).length;
    const step2 = userIds.filter((id) => pageviewsByUser[id] >= 2).length;
    const step3 = userIds.filter((id) => pageviewsByUser[id] >= 3).length;

    return Response.json({
      referring: Object.entries(referring)
        .map(([label, value]) => ({ label: label === "null" || !label ? "$direct" : label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
      funnel: [
        { count: step1, label: "First page view" },
        { count: step2, label: "Second page view" },
        { count: step3, label: "Third page view" },
      ],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
