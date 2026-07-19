"use client";

import { useState } from "react";

/** Fires the single "schedule is up" nudge (bell + push) to the group. */
export function AnnounceButton({ eventId }: { eventId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function announce() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/event/${eventId}/announce`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      setResult(
        res.ok
          ? `Nudged ${data.notified} ${data.notified === 1 ? "person" : "people"} ✓`
          : data.error ?? "Couldn't announce"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={announce}
        disabled={busy}
        className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
      >
        {busy ? "Announcing…" : "📣 Announce schedule to the group"}
      </button>
      {result && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{result}</span>
      )}
    </div>
  );
}
