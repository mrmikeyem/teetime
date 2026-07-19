"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type EventFormInitial = {
  id: string;
  name: string;
  location: string;
  rules: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  standingsMode: "TEAM_CUMULATIVE" | "INDIVIDUAL_POINTS";
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";
const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";
// Native date inputs: theme the built-in calendar and open it from a click
// anywhere in the field, not just the tiny picker icon.
const dateClass = `${inputClass} cursor-pointer [color-scheme:light] dark:[color-scheme:dark]`;

function openPicker(e: React.MouseEvent<HTMLInputElement>) {
  try {
    e.currentTarget.showPicker();
  } catch {
    // Not allowed outside a user gesture / unsupported — the icon still works.
  }
}

export function EventForm({ initial }: { initial?: EventFormInitial }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [rules, setRules] = useState(initial?.rules ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [standingsMode, setStandingsMode] = useState<
    "TEAM_CUMULATIVE" | "INDIVIDUAL_POINTS"
  >(initial?.standingsMode ?? "TEAM_CUMULATIVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        initial ? `/api/event/${initial.id}` : "/api/event",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            location,
            rules,
            startDate,
            endDate,
            standingsMode,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push(`/events/${initial ? initial.id : data.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    if (!initial) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/event/${initial.id}`, { method: "DELETE" });
    setSaving(false);
    if (res.ok) {
      router.push("/events");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't delete the event");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
    >
      <div>
        <label className={labelClass} htmlFor="ev-name">
          Event name
        </label>
        <input
          id="ev-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Man Weekend 2026"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="ev-location">
          Location <span className="font-normal normal-case">(optional)</span>
        </label>
        <input
          id="ev-location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Town, lodging, home base…"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="ev-start">
            Starts
          </label>
          <input
            id="ev-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            onClick={openPicker}
            required
            className={dateClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="ev-end">
            Ends
          </label>
          <input
            id="ev-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            onClick={openPicker}
            required
            className={dateClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="ev-mode">
          Standings
        </label>
        <select
          id="ev-mode"
          value={standingsMode}
          onChange={(e) =>
            setStandingsMode(
              e.target.value as "TEAM_CUMULATIVE" | "INDIVIDUAL_POINTS"
            )
          }
          className={inputClass}
        >
          <option value="TEAM_CUMULATIVE">
            Team — cumulative strokes (fixed teams)
          </option>
          <option value="INDIVIDUAL_POINTS">
            Individual points (teams can rotate by round)
          </option>
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="ev-rules">
          Rules <span className="font-normal normal-case">(optional — shown on the hub)</span>
        </label>
        <textarea
          id="ev-rules"
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          rows={5}
          placeholder={
            "Scoring will be cumulative thru all three rounds. Double bogey max…"
          }
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {initial ? "Save changes" : "Create event"}
        </button>
        {initial && (
          <button
            type="button"
            onClick={destroy}
            disabled={saving}
            className={`ml-auto rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
              confirmDelete
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {confirmDelete ? "Really delete event?" : "Delete event"}
          </button>
        )}
      </div>
    </form>
  );
}
