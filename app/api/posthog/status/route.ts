import { posthogGet } from "@/lib/posthog-api";

export async function GET() {
  try {
    await posthogGet("/session_recordings/", { limit: "1" });
    return Response.json({
      connected: true,
      projectId: process.env.POSTHOG_PROJECT_ID || "123893",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({
      connected: false,
      error: message,
    });
  }
}
