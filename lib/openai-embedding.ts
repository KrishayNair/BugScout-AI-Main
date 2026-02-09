/**
 * Minimal embedding function for Chroma that uses OpenAI's text-embedding-3-small.
 * Use this when CHROMA_API_KEY is set so Chroma can embed documents (avoids @chroma-core/default-embed).
 */

const OPENAI_EMBED_MODEL = "text-embedding-3-small";

async function embedBatch(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required for Chroma embeddings");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: OPENAI_EMBED_MODEL, input: texts }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return data.data.map((d) => d.embedding);
}

/** Chroma EmbeddingFunction using OpenAI. Return null if OPENAI_API_KEY is not set. */
export function getOpenAIEmbeddingFunction(): {
  generate: (texts: string[]) => Promise<number[][]>;
  generateQueryEmbeddings?: (texts: string[]) => Promise<number[][]>;
} | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return {
    async generate(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      const batchSize = 100;
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const chunk = texts.slice(i, i + batchSize);
        out.push(...(await embedBatch(chunk)));
      }
      return out;
    },
    async generateQueryEmbeddings(texts: string[]): Promise<number[][]> {
      return this.generate!(texts);
    },
  };
}
