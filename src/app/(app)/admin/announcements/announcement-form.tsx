"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AnnouncementForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [notifyBell, setNotifyBell] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const canSubmit =
    title.trim().length > 0 && body.trim().length > 0 && status === "sending" === false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("sending");
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || null,
          notifyBell,
          notifyEmail,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't publish. Try again.");
        return;
      }
      setDone(
        `Published${data.bells ? ` · ${data.bells} bells` : ""}${data.emails ? ` · ${data.emails} emails` : ""}`
      );
      setTitle("");
      setBody("");
      setUrl("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setStatus("idle");
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        New announcement
      </p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        placeholder="Title — e.g. Wind-aware forecasts"
        className={inputClass}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={4}
        placeholder="What it is and why they'll care. Plain text."
        className={inputClass}
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        maxLength={300}
        placeholder='Optional in-app link — e.g. "/teams"'
        className={inputClass}
      />
      <div className="flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-200">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={notifyBell}
            onChange={(e) => setNotifyBell(e.target.checked)}
            className="h-4 w-4 accent-emerald-700"
          />
          Nudge the bell
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.checked)}
            className="h-4 w-4 accent-emerald-700"
          />
          Also email members
        </label>
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {done && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {done} ✓
        </p>
      )}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {status === "sending" ? "Publishing…" : "Publish"}
      </button>
    </form>
  );
}

export function DeleteAnnouncementButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Delete announcement "${title}"?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="ml-auto text-xs font-semibold text-red-600 underline underline-offset-2 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
