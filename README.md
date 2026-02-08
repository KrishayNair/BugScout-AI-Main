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
