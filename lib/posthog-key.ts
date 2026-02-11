/**
 * Resolve the PostHog API key to use for the current request: user's saved key from DB, or env fallback.
 * Use in API routes; auth() is request-scoped.
 */
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { developerPosthogKeys } from "@/lib/db/schema";

export async function getPosthogKey(): Promise<string | null> {
  const { userId } = await auth();
  if (userId && process.env.DATABASE_URL) {
    try {
      const [row] = await db
        .select({ apiKey: developerPosthogKeys.apiKey })
        .from(developerPosthogKeys)
        .where(eq(developerPosthogKeys.userId, userId))
        .limit(1);
      if (row?.apiKey) return row.apiKey;
    } catch {
      // ignore; fall back to env
    }
  }
  return process.env.NEXT_POST_HOG_KEY?.trim() || null;
}
