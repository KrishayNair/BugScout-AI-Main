"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

export default function SettingsPage() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
    }
  }, [user]);

  const handleSaveName = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      await user.update({ firstName: firstName.trim() || undefined, lastName: lastName.trim() || undefined });
      setMessage({ type: "success", text: "Display name updated." });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to update name." });
    } finally {
      setSaving(false);
    }
  }, [user, firstName, lastName]);

  const handleSignOut = useCallback(() => {
    signOut({ redirectUrl: "/" });
  }, [signOut]);

  const nameChanged =
    (user?.firstName ?? "") !== firstName.trim() || (user?.lastName ?? "") !== lastName.trim();

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Manage your account and preferences.</p>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-xl space-y-6">
          {/* Display name */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Display name</h2>
            <p className="mt-1 text-sm text-gray-500">This is how your name appears in the app.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="settings-first-name" className="block text-sm font-medium text-gray-700">
                  First name
                </label>
                <input
                  id="settings-first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="First name"
                />
              </div>
              <div>
                <label htmlFor="settings-last-name" className="block text-sm font-medium text-gray-700">
                  Last name
                </label>
                <input
                  id="settings-last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Last name"
                />
              </div>
            </div>
            {message && (
              <p
                className={`mt-3 text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}
              >
                {message.text}
              </p>
            )}
            <div className="mt-4">
              <button
                type="button"
                onClick={handleSaveName}
                disabled={saving || !nameChanged}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-50 disabled:hover:bg-primary"
              >
                {saving ? "Saving…" : "Save name"}
              </button>
            </div>
          </section>

          {/* Sign out */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Sign out</h2>
            <p className="mt-1 text-sm text-gray-500">Sign out of your account on this device.</p>
            <div className="mt-4">
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                Sign out
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
