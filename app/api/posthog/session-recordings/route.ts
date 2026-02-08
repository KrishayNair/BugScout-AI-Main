import { NextRequest } from "next/server";
import { posthogGet } from "@/lib/posthog-api";

export const dynamic = "force-dynamic";

const RECORDINGS_PARAMS = new Set(["limit", "offset", "date_from", "date_to"]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (RECORDINGS_PARAMS.has(key)) params[key] = value;
    });
    const data = await posthogGet("/session_recordings/", Object.keys(params).length ? params : undefined);
    return Response.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
