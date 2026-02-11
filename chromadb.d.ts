/**
 * Stub type declaration for optional dependency "chromadb".
 * When chromadb is not installed (e.g. Vercel with npm install --no-optional),
 * TypeScript still type-checks; at runtime the dynamic import will fail and we no-op.
 */
declare module "chromadb" {
  export class CloudClient {
    constructor(options: {
      apiKey: string;
      tenant?: string;
      database?: string;
    });
    getOrCreateCollection(options: {
      name: string;
      embeddingFunction: unknown;
    }): Promise<{
      add(options: {
        ids: string[];
        documents: string[];
        metadatas: Record<string, string | number | boolean>[];
      }): Promise<void>;
    }>;
  }
}
