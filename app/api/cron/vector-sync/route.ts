import { NextRequest } from "next/server";
import { VectorSyncService } from "@/lib/vector-sync.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Auto-sync: Neon → Chroma. Call periodically (e.g. Vercel Cron every 10 min).
 * Optional: set CRON_SECRET in env and send Authorization: Bearer <CRON_SECRET> to avoid public hits.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false, message: "DATABASE_URL not set" }, { status: 503 });
  }
  if (!process.env.CHROMA_API_KEY) {
    return Response.json({ ok: false, message: "CHROMA_API_KEY not set" }, { status: 503 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { ok: false, message: "OPENAI_API_KEY not set. Chroma needs it for embeddings." },
      { status: 503 }
    );
  }

  try {
    const synced = await VectorSyncService.syncAll();
    return Response.json({ ok: true, synced });
  } catch (e) {
    console.error("cron vector-sync error:", e);
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}
