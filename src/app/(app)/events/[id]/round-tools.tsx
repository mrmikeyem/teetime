"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

/** Admin-only per-round tools: rename/reformat + delete (two-step). */
export function RoundTools({
  eventId,
  roundId,
  name,
  format,
}: {
  eventId: string;
  roundId: string;
  name: string | null;
  format: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name ?? "");
  const [draftFormat, setDraftFormat] = useState(format ?? "");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await fetch(`/api/event/${eventId}/rounds/${roundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftName, format: draftFormat }),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/event/${eventId}/rounds/${roundId}`, {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Round name"
          className={`min-w-36 flex-1 ${inputClass}`}
        />
        <select
          value={draftFormat}
          onChange={(e) => setDraftFormat(e.target.value)}
          className={inputClass}
          aria-label="Format"
        >
          <option value="">Format —</option>
          <option value="SCRAMBLE">Scramble</option>
          <option value="BEST_BALL">Best ball</option>
          <option value="STROKE">Stroke</option>
          <option value="MATCH_PLAY">Match play</option>
          <option value="OTHER">Other</option>
        </select>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={busy}
          className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => {
          setDraftName(name ?? "");
          setDraftFormat(format ?? "");
          setEditing(true);
        }}
        className="rounded-lg bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
      >
        ✏️ Edit round
      </button>
      <button
        type="button"
        onClick={destroy}
        onBlur={() => setConfirm(false)}
        disabled={busy}
        className={`rounded-lg px-2 py-1 text-xs font-semibold ${
          confirm
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-gray-200 text-gray-500 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
        }`}
      >
        {confirm ? "Delete round + tee times?" : "Delete round"}
      </button>
    </div>
  );
}
