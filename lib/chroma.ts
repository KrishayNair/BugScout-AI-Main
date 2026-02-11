import { getOpenAIEmbeddingFunction } from "./openai-embedding";

// Lazy-loaded to avoid pulling chromadb into serverless bundle (stays under Vercel 250 MB limit).
// When chromadb is excluded via outputFileTracingExcludes, this returns null and Chroma sync is a no-op.
let client: unknown = undefined;

async function loadChromaClient(): Promise<unknown | null> {
  if (!process.env.CHROMA_API_KEY) return null;
  if (client !== undefined) return client;
  try {
    const { CloudClient } = await import("chromadb").catch(() => ({ CloudClient: null }));
    if (!CloudClient) {
      client = null;
      return null;
    }
    client = new CloudClient({
      apiKey: process.env.CHROMA_API_KEY,
      tenant: process.env.CHROMA_TENANT ?? "38d2507b-966b-47d3-b7a5-dd1385383481",
      database: process.env.CHROMA_DATABASE ?? "bugScoutAI-main",
    });
    return client;
  } catch {
    client = null;
    return null;
  }
}

/** Chroma metadata values must be string, number, or boolean. */
function sanitizeMetadata(meta: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
    else out[k] = String(v);
  }
  return out;
}

export type ChromaDoc = {
  id: string;
  document: string;
  metadata: Record<string, unknown>;
};

/**
 * Add documents to a Chroma collection. No-op if CHROMA_API_KEY is not set or on error.
 * Uses collection name per Neon table: monitoring, issues, logs, posthog_events.
 */
export async function addToChroma(
  collectionName: string,
  items: ChromaDoc[]
): Promise<void> {
  if (items.length === 0) return;
  const chroma = await loadChromaClient();
  if (!chroma) return;
  const embeddingFunction = getOpenAIEmbeddingFunction();
  if (!embeddingFunction) {
    console.warn(
      "[Chroma] OPENAI_API_KEY not set; skipping sync. Set it in .env.local for Chroma embeddings."
    );
    return;
  }
  try {
    const chromaApi = chroma as {
      getOrCreateCollection(opts: { name: string; embeddingFunction: unknown }): Promise<{
        add(opts: { ids: string[]; documents: string[]; metadatas: Record<string, string | number | boolean>[] }): Promise<void>;
      }>;
    };
    const collection = await chromaApi.getOrCreateCollection({
      name: collectionName,
      embeddingFunction,
    });
    const ids = items.map((i) => i.id);
    const documents = items.map((i) => i.document);
    const metadatas = items.map((i) => sanitizeMetadata({ ...i.metadata, source: "bugscout" }));
    await collection.add({ ids, documents, metadatas });
  } catch (e) {
    console.error(`[Chroma] addToChroma(${collectionName}) error:`, e);
  }
}
