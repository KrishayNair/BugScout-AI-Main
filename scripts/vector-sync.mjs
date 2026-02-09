#!/usr/bin/env node
/**
 * Manual sync: Neon → Chroma. Run with dev server up: npm run vector:sync
 * Or call GET /api/db/sync-to-chroma directly.
 */
const base = process.env.SYNC_BASE_URL || "http://localhost:3000";
const url = `${base}/api/db/vector-sync`;

fetch(url)
  .then(async (r) => {
    const text = await r.text();
    const isJson = r.headers.get("content-type")?.includes("application/json");
    if (!isJson) {
      console.error("vector:sync failed: server returned non-JSON (status " + r.status + ").");
      console.error("Make sure the dev server is running: npm run dev");
      if (text.startsWith("<!")) {
        console.error("(Got HTML – is " + base + " your Next.js app?)");
      }
      process.exit(1);
      return;
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("vector:sync failed: invalid JSON from server.");
      process.exit(1);
      return;
    }
    console.log(JSON.stringify(data, null, 2));
    process.exit(data.ok ? 0 : 1);
  })
  .catch((err) => {
    console.error("vector:sync failed:", err.message);
    console.error("Is the dev server running? Try: npm run dev");
    process.exit(1);
  });
