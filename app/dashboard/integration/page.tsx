"use client";

import { useEffect, useState } from "react";

export default function IntegrationPage() {
  const [status, setStatus] = useState<{ connected: boolean; error?: string; projectId?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  function loadStatus() {
    setLoading(true);
    fetch("/api/posthog/status")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ connected: false, error: "Request failed" }))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadStatus();
  }, []);

  function handleTestConnection() {
    setTesting(true);
    fetch("/api/posthog/status")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .finally(() => setTesting(false));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect PostHog to power session replays and analytics in this app.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <svg
              className="h-6 w-6 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">PostHog</h2>
            <p className="text-sm text-gray-500">Session recordings, events, and analytics</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Checking connection…
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                  status?.connected
                    ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${status?.connected ? "bg-green-500" : "bg-amber-500"}`}
                />
                {status?.connected ? "Connected" : "Not connected"}
              </span>
              {status?.connected && status?.projectId && (
                <span className="text-sm text-gray-500">Project ID: {status.projectId}</span>
              )}
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {testing ? "Testing…" : "Test connection"}
              </button>
            </div>

            {status?.error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {status.error}
              </div>
            )}

            <div className="mt-6 border-t border-gray-100 pt-6">
              <h3 className="text-sm font-semibold text-gray-900">How to connect</h3>
              <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-gray-600">
                <li>
                  Log in to your PostHog project (e.g.{" "}
                  <a
                    href="https://eu.posthog.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    eu.posthog.com
                  </a>{" "}
                  or us.posthog.com).
                </li>
                <li>
                  Create a <strong>Personal API key</strong> in PostHog: Project Settings → Personal
                  API Keys → Create key.
                </li>
                <li>
                  Ensure the key has at least: <code className="rounded bg-gray-100 px-1">session_recording:read</code>,{" "}
                  <code className="rounded bg-gray-100 px-1">sharing_configuration:read</code>,{" "}
                  <code className="rounded bg-gray-100 px-1">sharing_configuration:write</code> (needed for in-app replay embed).
                </li>
                <li>
                  Add to your <code className="rounded bg-gray-100 px-1">.env.local</code>:
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
                    NEXT_POST_HOG_KEY=phx_your_key_here
                  </pre>
                </li>
                <li>Restart the dev server and click “Test connection” above.</li>
              </ol>
              <p className="mt-4 text-sm text-gray-500">
                Once connected, the Dashboard will show recordings and analytics, and you can watch
                session replays inside this site. Replays are embedded via PostHog’s public sharing
                (no PostHog login required in the iframe).
              </p>
              <p className="mt-2 text-sm text-gray-500">
                This app uses the <strong>EU embed URL</strong> (<code className="rounded bg-gray-100 px-1">eu.posthog.com/embedded</code>) by default. If replays still don’t load, add to <code className="rounded bg-gray-100 px-1">.env.local</code>:{" "}
                <code className="rounded bg-gray-100 px-1">POSTHOG_EMBED_BASE=https://app.posthog.com/embedded</code> and restart.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
