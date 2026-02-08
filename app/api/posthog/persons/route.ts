import { NextRequest } from "next/server";
import { posthogGet } from "@/lib/posthog-api";

export const dynamic = "force-dynamic";

const PERSONS_PARAMS = new Set(["limit", "offset", "search", "distinct_id", "email"]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (PERSONS_PARAMS.has(key)) params[key] = value;
    });
    const data = await posthogGet("/persons/", Object.keys(params).length ? params : undefined);
    return Response.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
