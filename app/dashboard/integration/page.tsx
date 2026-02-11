"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

type NotificationEmail = { id: string; email: string; createdAt: string };
type SlackWebhook = { id: string; webhookUrl: string; createdAt: string };

export default function IntegrationPage() {
  const [status, setStatus] = useState<{ connected: boolean; error?: string; projectId?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const [notificationEmails, setNotificationEmails] = useState<NotificationEmail[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailAdding, setEmailAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailMessage, setTestEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [slackWebhooks, setSlackWebhooks] = useState<SlackWebhook[]>([]);
  const [webhookInput, setWebhookInput] = useState("");
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [webhookAdding, setWebhookAdding] = useState(false);
  const [removingWebhookId, setRemovingWebhookId] = useState<string | null>(null);
  const [testWebhookSending, setTestWebhookSending] = useState(false);
  const [testWebhookMessage, setTestWebhookMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [posthogHasKey, setPosthogHasKey] = useState(false);
  const [posthogMasked, setPosthogMasked] = useState<string | null>(null);
  const [posthogKeyInput, setPosthogKeyInput] = useState("");
  const [posthogKeyError, setPosthogKeyError] = useState<string | null>(null);
  const [posthogKeySaving, setPosthogKeySaving] = useState(false);
  const [posthogKeyRemoving, setPosthogKeyRemoving] = useState(false);

  const [connectionTestMessage, setConnectionTestMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function loadStatus() {
    setLoading(true);
    fetch("/api/posthog/status")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ connected: false, error: "Request failed" }))
      .finally(() => setLoading(false));
  }

  const loadNotificationEmails = useCallback(() => {
    fetch("/api/notifications/emails")
      .then((r) => {
        if (!r.ok) return; // e.g. 401 – keep existing state, don't overwrite with []
        return r.json();
      })
      .then((data) => {
        if (data != null && Array.isArray(data.emails)) setNotificationEmails(data.emails);
      })
      .catch(() => {
        // On network error leave list unchanged so saved emails are not wiped
      });
  }, []);

  useEffect(() => {
    loadStatus();
    loadNotificationEmails();
  }, [loadNotificationEmails]);

  // Refetch emails when tab gains focus (e.g. auth may be ready now) so list stays in sync
  useEffect(() => {
    const onFocus = () => loadNotificationEmails();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadNotificationEmails]);

  const loadSlackWebhooks = useCallback(() => {
    fetch("/api/notifications/slack-webhooks")
      .then((r) => {
        if (!r.ok) return;
        return r.json();
      })
      .then((data) => {
        if (data != null && Array.isArray(data.webhooks)) setSlackWebhooks(data.webhooks);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadSlackWebhooks();
  }, [loadSlackWebhooks]);

  useEffect(() => {
    const onFocus = () => loadSlackWebhooks();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadSlackWebhooks]);

  const loadPosthogKey = useCallback(() => {
    fetch("/api/notifications/posthog-key")
      .then((r) => {
        if (!r.ok) return;
        return r.json();
      })
      .then((data) => {
        if (data && typeof data.hasKey === "boolean") {
          setPosthogHasKey(data.hasKey);
          setPosthogMasked(data.masked ?? null);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPosthogKey();
  }, [loadPosthogKey]);

  useEffect(() => {
    const onFocus = () => loadPosthogKey();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadPosthogKey]);

  function handleTestConnection() {
    setTesting(true);
    setConnectionTestMessage(null);
    fetch("/api/posthog/status")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        if (data.connected) {
          setConnectionTestMessage({
            type: "success",
            text: "Connection successful. PostHog is connected and ready.",
          });
        } else {
          setConnectionTestMessage({
            type: "error",
            text: data.error || "Connection failed. Check your API key and try again.",
          });
        }
      })
      .catch(() => {
        setConnectionTestMessage({
          type: "error",
          text: "Connection failed. Request failed or server error.",
        });
      })
      .finally(() => setTesting(false));
  }

  return (
    <div className="flex h-full flex-col min-h-0">
      {connectionTestMessage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="connection-test-title"
          onClick={() => setConnectionTestMessage(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl border shadow-2xl ${
              connectionTestMessage.type === "success"
                ? "border-green-200 bg-white"
                : "border-red-200 bg-white"
            }`}
          >
            <div className="p-6">
              <div className="flex items-center gap-3">
                {connectionTestMessage.type === "success" ? (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
                    <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                    <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 id="connection-test-title" className="text-base font-semibold text-gray-900">
                    {connectionTestMessage.type === "success" ? "Connection successful" : "Connection failed"}
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-600">{connectionTestMessage.text}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConnectionTestMessage(null)}
                className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                OK
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="mx-auto w-full max-w-7xl p-6 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Integration</h1>
            <p className="mt-2 text-base text-gray-500">Connect PostHog, issue notifications, and Slack — manage everything in one place.</p>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-8">
            {/* PostHog */}
            <motion.section
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={0}
              className="flex min-w-0 flex-col rounded-2xl border border-gray-200/80 bg-white p-6 shadow-md shadow-gray-200/50 transition-all duration-300 hover:shadow-lg hover:shadow-gray-200/60 hover:border-primary/20"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 transition-transform duration-200 hover:scale-105">
                  <svg className="h-7 w-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900">PostHog</h2>
                  <p className="text-sm text-gray-500">Recordings & analytics</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <input
                  type="password"
                  placeholder="phx_your_key_here"
                  value={posthogKeyInput}
                  onChange={(e) => { setPosthogKeyInput(e.target.value); setPosthogKeyError(null); }}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm transition-all duration-200 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoComplete="off"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={posthogKeySaving || !posthogKeyInput.trim()}
                    onClick={async () => {
                      const key = posthogKeyInput.trim();
                      if (!key) return;
                      setPosthogKeyError(null);
                      setPosthogKeySaving(true);
                      try {
                        const r = await fetch("/api/notifications/posthog-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: key }) });
                        const data = await r.json();
                        if (!r.ok) { setPosthogKeyError(data.error ?? "Failed to save"); return; }
                        setPosthogKeyInput("");
                        loadPosthogKey();
                        loadStatus();
                      } finally { setPosthogKeySaving(false); }
                    }}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow disabled:translate-y-0 disabled:opacity-50 active:translate-y-0"
                  >
                    {posthogKeySaving ? "Saving…" : posthogHasKey ? "Update key" : "Add key"}
                  </button>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing || !posthogHasKey}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:translate-y-0 disabled:opacity-50 active:translate-y-0"
                  >
                    {testing ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
                        Testing…
                      </span>
                    ) : (
                      "Test connection"
                    )}
                  </button>
                  {posthogHasKey && (
                    <button
                      type="button"
                      disabled={posthogKeyRemoving}
                      onClick={async () => {
                        setPosthogKeyRemoving(true);
                        try {
                          await fetch("/api/notifications/posthog-key", { method: "DELETE" });
                          loadPosthogKey();
                          setPosthogHasKey(false);
                          setPosthogMasked(null);
                          loadStatus();
                        } finally { setPosthogKeyRemoving(false); }
                      }}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 active:scale-[0.98]"
                    >
                      {posthogKeyRemoving ? "Removing…" : "Remove"}
                    </button>
                  )}
                </div>
                {posthogKeyError && <p className="text-sm text-red-600">{posthogKeyError}</p>}
                {posthogHasKey && posthogMasked && (
                  <p className="text-sm text-gray-600">Saved: <code className="rounded-lg bg-gray-100 px-2 py-0.5 font-mono text-xs">{posthogMasked}</code></p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
                {loading ? (
                  <span className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Checking…
                  </span>
                ) : (
                  <>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
                        status?.connected
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${status?.connected ? "bg-green-500 animate-pulse" : "bg-amber-500"}`} />
                      {status?.connected ? "Connected" : "Not connected"}
                    </span>
                    {status?.connected && status?.projectId && (
                      <span className="text-sm text-gray-500">Project ID: {status.projectId}</span>
                    )}
                  </>
                )}
              </div>
              {status?.error && <p className="mt-2 text-sm text-red-600">{status.error}</p>}
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-sm font-medium text-gray-700">How to get your API key</p>
                <ol className="list-inside list-decimal space-y-1 text-sm text-gray-600">
                  <li>PostHog → <strong>Project settings</strong> → <strong>Personal API keys</strong> → Create key</li>
                  <li>Enable <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">session_recording:read</code> and <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">sharing_configuration:read/write</code></li>
                  <li>Copy key → paste above</li>
                </ol>
              </div>
            </motion.section>

            {/* Issue notifications (Email) */}
            <motion.section
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={1}
              className="flex min-w-0 flex-col rounded-2xl border border-gray-200/80 bg-white p-6 shadow-md shadow-gray-200/50 transition-all duration-300 hover:shadow-lg hover:shadow-gray-200/60 hover:border-primary/20"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 transition-transform duration-200 hover:scale-105">
                  <svg className="h-7 w-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900">Issue notifications</h2>
                  <p className="text-sm text-gray-500">Email on new issue</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <input
                  type="email"
                  placeholder="developer@example.com"
                  value={emailInput}
                  onChange={(e) => { setEmailInput(e.target.value); setEmailError(null); }}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm transition-all duration-200 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={emailAdding || !emailInput.trim()}
                    onClick={async () => {
                      const email = emailInput.trim();
                      if (!email) return;
                      setEmailError(null);
                      setEmailAdding(true);
                      try {
                        const r = await fetch("/api/notifications/emails", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
                        const data = await r.json();
                        if (!r.ok) { setEmailError(data.error ?? "Failed"); return; }
                        setEmailInput("");
                        loadNotificationEmails();
                      } finally { setEmailAdding(false); }
                    }}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow disabled:translate-y-0 disabled:opacity-50 active:translate-y-0"
                  >
                    {emailAdding ? "Adding…" : "Add email"}
                  </button>
                  <button
                    type="button"
                    disabled={testEmailSending || (!emailInput.trim() && !notificationEmails.length)}
                    onClick={async () => {
                      const email = emailInput.trim() || notificationEmails[0]?.email;
                      if (!email) return;
                      setTestEmailMessage(null);
                      setTestEmailSending(true);
                      try {
                        const r = await fetch("/api/notifications/emails/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
                        const data = await r.json();
                        setTestEmailMessage(r.ok && data.ok ? { type: "success", text: "Test sent. Check your inbox (and spam)." } : { type: "error", text: data.error ?? "Failed." });
                      } catch { setTestEmailMessage({ type: "error", text: "Failed." }); }
                      finally { setTestEmailSending(false); }
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:translate-y-0 disabled:opacity-50 active:translate-y-0"
                    title={!emailInput.trim() && notificationEmails.length > 0 ? "Uses first saved" : undefined}
                  >
                    {testEmailSending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
                        Sending…
                      </span>
                    ) : (
                      "Send test"
                    )}
                  </button>
                </div>
                {emailError && <p className="text-sm text-red-600">{emailError}</p>}
                {testEmailMessage && (
                  <p className={`text-sm transition-opacity duration-200 ${testEmailMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                    {testEmailMessage.text}
                  </p>
                )}
                <ul className="max-h-28 space-y-1.5 overflow-y-auto">
                  {notificationEmails.length > 0 ? notificationEmails.map((item, idx) => (
                    <motion.li
                      key={item.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.2 }}
                      className="group flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 text-sm transition-colors duration-200 hover:border-primary/20 hover:bg-primary/5"
                    >
                      <span className="truncate text-gray-800">{item.email}</span>
                      <button
                        type="button"
                        disabled={removingId === item.id}
                        onClick={async () => { setRemovingId(item.id); try { await fetch(`/api/notifications/emails/${item.id}`, { method: "DELETE" }); loadNotificationEmails(); } finally { setRemovingId(null); } }}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 opacity-70 transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:opacity-100 disabled:opacity-50 group-hover:opacity-100"
                      >
                        {removingId === item.id ? "Removing…" : "Remove"}
                      </button>
                    </motion.li>
                  )) : <li className="py-3 text-center text-sm text-gray-500">No emails yet. Add one above.</li>}
                </ul>
              </div>
            </motion.section>

            {/* Slack */}
            <motion.section
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={2}
              className="flex min-w-0 flex-col rounded-2xl border border-gray-200/80 bg-white p-6 shadow-md shadow-gray-200/50 transition-all duration-300 hover:shadow-lg hover:shadow-gray-200/60 hover:border-[#4A154B]/20"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#4A154B]/10 transition-transform duration-200 hover:scale-105">
                  <svg className="h-7 w-7 text-[#4A154B]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900">Slack</h2>
                  <p className="text-sm text-gray-500">Issue alerts in channel</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/..."
                  value={webhookInput}
                  onChange={(e) => { setWebhookInput(e.target.value); setWebhookError(null); }}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm transition-all duration-200 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={webhookAdding || !webhookInput.trim()}
                    onClick={async () => {
                      const url = webhookInput.trim();
                      if (!url) return;
                      setWebhookError(null);
                      setWebhookAdding(true);
                      try {
                        const r = await fetch("/api/notifications/slack-webhooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ webhookUrl: url }) });
                        const data = await r.json();
                        if (!r.ok) { setWebhookError(data.error ?? "Failed"); return; }
                        setWebhookInput("");
                        loadSlackWebhooks();
                      } finally { setWebhookAdding(false); }
                    }}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow disabled:translate-y-0 disabled:opacity-50 active:translate-y-0"
                  >
                    {webhookAdding ? "Adding…" : "Add webhook"}
                  </button>
                  <button
                    type="button"
                    disabled={testWebhookSending || (!webhookInput.trim() && !slackWebhooks.length)}
                    onClick={async () => {
                      const url = webhookInput.trim() || slackWebhooks[0]?.webhookUrl;
                      if (!url) return;
                      setTestWebhookMessage(null);
                      setTestWebhookSending(true);
                      try {
                        const r = await fetch("/api/notifications/slack-webhooks/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ webhookUrl: url }) });
                        const data = await r.json();
                        setTestWebhookMessage(r.ok && data.ok ? { type: "success", text: "Test sent to Slack. Check your channel." } : { type: "error", text: data.error ?? "Failed." });
                      } catch { setTestWebhookMessage({ type: "error", text: "Failed." }); }
                      finally { setTestWebhookSending(false); }
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:translate-y-0 disabled:opacity-50 active:translate-y-0"
                    title={!webhookInput.trim() && slackWebhooks.length > 0 ? "Uses first saved" : undefined}
                  >
                    {testWebhookSending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
                        Sending…
                      </span>
                    ) : (
                      "Send test"
                    )}
                  </button>
                </div>
                {webhookError && <p className="text-sm text-red-600">{webhookError}</p>}
                {testWebhookMessage && (
                  <p className={`text-sm transition-opacity duration-200 ${testWebhookMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                    {testWebhookMessage.text}
                  </p>
                )}
                <ul className="max-h-28 space-y-1.5 overflow-y-auto">
                  {slackWebhooks.length > 0 ? slackWebhooks.map((item, idx) => (
                    <motion.li
                      key={item.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.2 }}
                      className="group flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 text-sm transition-colors duration-200 hover:border-[#4A154B]/20 hover:bg-[#4A154B]/5"
                    >
                      <span className="truncate text-gray-800" title={item.webhookUrl}>{item.webhookUrl}</span>
                      <button
                        type="button"
                        disabled={removingWebhookId === item.id}
                        onClick={async () => { setRemovingWebhookId(item.id); try { await fetch(`/api/notifications/slack-webhooks/${item.id}`, { method: "DELETE" }); loadSlackWebhooks(); } finally { setRemovingWebhookId(null); } }}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 opacity-70 transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:opacity-100 disabled:opacity-50 group-hover:opacity-100"
                      >
                        {removingWebhookId === item.id ? "Removing…" : "Remove"}
                      </button>
                    </motion.li>
                  )) : <li className="py-3 text-center text-sm text-gray-500">No webhooks yet. Add one above.</li>}
                </ul>
              </div>
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-sm font-medium text-gray-700">How to get your webhook URL</p>
                <ol className="list-inside list-decimal space-y-1 text-sm text-gray-600">
                  <li>Slack → <strong>Apps</strong> → <strong>Incoming Webhooks</strong> → Add to workspace</li>
                  <li>Pick a channel → copy the webhook URL</li>
                  <li>Paste above</li>
                </ol>
              </div>
            </motion.section>
          </div>
        </div>
      </div>
    </div>
  );
}
