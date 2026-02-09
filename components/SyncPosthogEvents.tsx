"use client";

import { useEffect } from "react";

/** On mount, sync latest PostHog events into Neon posthog_events table. Runs on every dashboard visit. */
export function SyncPosthogEvents() {
  useEffect(() => {
    fetch("/api/db/events/sync").catch(() => {});
  }, []);
  return null;
}
