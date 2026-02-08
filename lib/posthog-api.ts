const POSTHOG_BASE = "https://eu.posthog.com";
const PROJECT_ID = "123893";

function getAuthHeaders(): HeadersInit {
  const key = process.env.NEXT_POST_HOG_KEY;
  if (!key) {
    throw new Error("NEXT_POST_HOG_KEY is not set");
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function posthogFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${POSTHOG_BASE}/api/projects/${PROJECT_ID}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...options.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function posthogGet<T>(path: string, searchParams?: Record<string, string>): Promise<T> {
  const url = searchParams
    ? `${POSTHOG_BASE}/api/projects/${PROJECT_ID}${path}?${new URLSearchParams(searchParams)}`
    : `${POSTHOG_BASE}/api/projects/${PROJECT_ID}${path}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function posthogPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${POSTHOG_BASE}/api/projects/${PROJECT_ID}${path}`, {
    method: "POST",
    headers: getAuthHeaders(),
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
  const res = await fetch(`${POSTHOG_BASE}/api/projects/${PROJECT_ID}${path}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
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
