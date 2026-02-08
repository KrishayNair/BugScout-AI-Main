import { posthogGet } from "@/lib/posthog-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await posthogGet("/feature_flags/");
    return Response.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
