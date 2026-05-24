"use client";

import { useState } from "react";
import {
  GROUP_WEEKEND_DEFAULT,
  GROUP_WEEKNIGHT_DEFAULT,
} from "@/lib/tee-time-defaults";

export function DefaultsForm({
  initial,
}: {
  initial: { weeknightDefault: string | null; weekendDefault: string | null };
}) {
  const [weeknight, setWeeknight] = useState(initial.weeknightDefault ?? "");
  const [weekend, setWeekend] = useState(initial.weekendDefault ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus("idle");
    setError("");
    const res = await fetch("/api/profile/defaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weeknightDefault: weeknight,
        weekendDefault: weekend,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't save");
      setStatus("error");
      return;
    }
    setStatus("saved");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Pre-fills the time on the new tee time form. Leave blank to use the
        group default ({GROUP_WEEKNIGHT_DEFAULT} weeknights,{" "}
        {GROUP_WEEKEND_DEFAULT} weekends).
      </p>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="weeknightDefault"
            className="block text-xs font-medium text-gray-600 dark:text-gray-300"
          >
            Mon–Fri
          </label>
          <input
            id="weeknightDefault"
            type="time"
            value={weeknight}
            onChange={(e) => {
              setWeeknight(e.target.value);
              setStatus("idle");
            }}
            placeholder={GROUP_WEEKNIGHT_DEFAULT}
            className="mt-1 block w-full appearance-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-emerald-700"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label
            htmlFor="weekendDefault"
            className="block text-xs font-medium text-gray-600 dark:text-gray-300"
          >
            Sat–Sun
          </label>
          <input
            id="weekendDefault"
            type="time"
            value={weekend}
            onChange={(e) => {
              setWeekend(e.target.value);
              setStatus("idle");
            }}
            placeholder={GROUP_WEEKEND_DEFAULT}
            className="mt-1 block w-full appearance-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-emerald-700"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}
      {status === "saved" && (
        <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/30 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          Saved.
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
