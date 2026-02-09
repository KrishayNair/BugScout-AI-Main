# BugScout Frontend

Next.js app with a landing page, Clerk auth, and a dashboard (blue theme, Inter font).

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Clerk**
   - Create an app at [clerk.com](https://clerk.com).
   - Copy `.env.local.example` to `.env.local` and set:
     - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
     - `CLERK_SECRET_KEY`

3. **PostHog (dashboard analytics)**
   - Add `NEXT_POST_HOG_KEY` (your PostHog personal API key, e.g. `phx_xxx`) to `.env.local`.
   - All PostHog requests are made from the backend only; the key is never exposed to the client.

4. **Run**
   ```bash
   npm run dev
   ```

- **Landing:** [http://localhost:3000](http://localhost:3000) — navbar with Sign in / Sign up (Clerk).
- **Dashboard:** [http://localhost:3000/dashboard](http://localhost:3000/dashboard) — PostHog-powered home (recordings, events, trends, users, flags), Issues view, Integration, Settings (blue theme, Inter).

## Routes

| Route        | Description                    |
| ------------ | ------------------------------ |
| `/`          | Landing page with navbar       |
| `/sign-in`   | Clerk sign in                  |
| `/sign-up`   | Clerk sign up                  |
| `/dashboard` | Main dashboard (protected)    |

Dashboard uses primary blue `#2563eb` (logo-style) and Inter via Tailwind and the Google Fonts link in the layout.

## Neon DB + ChromaDB sync

**Neon** (PostgreSQL) is the source of truth. **ChromaDB** is the vector store for embeddings and semantic search. The backend connects to both and syncs data from Neon to Chroma.

| Component   | Env / link |
| ----------- | ---------- |
| Neon        | `DATABASE_URL` in `.env.local` |
| Chroma Cloud| `CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE` in `.env.local` |

**Data flow**

1. **Ingestion** – When data is written to Neon (e.g. `POST /api/db/monitoring`, `POST /api/db/issues`, `POST /api/db/logs`, `POST /api/db/events`), the route calls `VectorSyncService.sync*()` so the same data is sent to Chroma.
2. **Manual sync** – To backfill or re-sync all Neon data to Chroma:
   - Call **`GET /api/db/sync-to-chroma`** (browser or curl), or
   - Run **`npm run vector:sync`** (requires dev server: `npm run dev`).
3. **Auto-sync** – Call **`GET /api/cron/vector-sync`** on a schedule (e.g. Vercel Cron every 10 min). Optional: set `CRON_SECRET` and send `Authorization: Bearer <CRON_SECRET>`.

**Where sync happens**

- **`lib/vector-sync.service.ts`** – `VectorSyncService`: `syncMonitoring()`, `syncIssues()`, `syncLogs()`, `syncPosthogEvents()`, `syncAll()`.
- **Ingestion** – API routes that insert into Neon call the service after the insert.
- **Manual** – `GET /api/db/sync-to-chroma` → `VectorSyncService.syncAll()`.
- **Cron** – `GET /api/cron/vector-sync` → `VectorSyncService.syncAll()`.
