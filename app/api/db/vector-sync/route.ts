import { NextRequest } from "next/server";
import { VectorSyncService } from "@/lib/vector-sync.service";

export const dynamic = "force-dynamic";

/** Manual sync: read all from Neon and push to Chroma. Call via GET /api/db/vector-sync or npm run vector:sync */
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false, message: "DATABASE_URL not set" }, { status: 503 });
  }
  if (!process.env.CHROMA_API_KEY) {
    return Response.json({ ok: false, message: "CHROMA_API_KEY not set. Add it to .env.local" }, { status: 503 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { ok: false, message: "OPENAI_API_KEY not set. Chroma needs it for embeddings. Add it to .env.local" },
      { status: 503 }
    );
  }

  try {
    const synced = await VectorSyncService.syncAll();
    return Response.json({
      ok: true,
      message: "Neon data synced to Chroma",
      synced,
    });
  } catch (e) {
    console.error("vector-sync error:", e);
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}
