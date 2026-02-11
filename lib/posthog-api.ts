import { getPosthogKey } from "@/lib/posthog-key";

const POSTHOG_BASE = "https://eu.posthog.com";
const PROJECT_ID = "123893";

function authHeaders(key: string): HeadersInit {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function getKey(): Promise<string> {
  const key = await getPosthogKey();
  if (!key) {
    throw new Error(
      "PostHog API key not set. Add one in Dashboard → Integration, or set NEXT_POST_HOG_KEY in .env.local."
    );
  }
  return key;
}

export async function posthogFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const key = await getKey();
  const url = `${POSTHOG_BASE}/api/projects/${PROJECT_ID}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(key), ...(options.headers as HeadersInit) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function posthogGet<T>(path: string, searchParams?: Record<string, string>): Promise<T> {
  const key = await getKey();
  const url = searchParams
    ? `${POSTHOG_BASE}/api/projects/${PROJECT_ID}${path}?${new URLSearchParams(searchParams)}`
    : `${POSTHOG_BASE}/api/projects/${PROJECT_ID}${path}`;
  const res = await fetch(url, {
    headers: authHeaders(key),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function posthogPost<T>(path: string, body: unknown): Promise<T> {
  const key = await getKey();
  const res = await fetch(`${POSTHOG_BASE}/api/projects/${PROJECT_ID}${path}`, {
    method: "POST",
    headers: authHeaders(key),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function posthogPatch<T>(path: string, body: unknown): Promise<T> {
  const key = await getKey();
  const res = await fetch(`${POSTHOG_BASE}/api/projects/${PROJECT_ID}${path}`, {
    method: "PATCH",
    headers: authHeaders(key),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// Use EU embed URL when using eu.posthog.com (app.posthog.com can show "Page not found" for EU projects)
export const POSTHOG_EMBED_BASE =
  process.env.POSTHOG_EMBED_BASE || "https://eu.posthog.com/embedded";
