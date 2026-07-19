"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

/**
 * The schedule builder: one submit = one round + all its tee times,
 * without the per-tee-time notification fan-out.
 */
export function RoundBuilder({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [format, setFormat] = useState("");
  const [course, setCourse] = useState("");
  const [date, setDate] = useState("");
  const [times, setTimes] = useState("");
  const [partySize, setPartySize] = useState("4");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const parsedTimes = times
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map(to24h);
      if (parsedTimes.some((t) => t === null)) {
        setError("Times look off — use e.g. “3:00pm, 3:08pm” or “15:00 15:08”");
        return;
      }
      const res = await fetch(`/api/event/${eventId}/rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          format,
          course,
          date,
          times: parsedTimes,
          partySize,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't create the round");
        return;
      }
      setName("");
      setCourse("");
      setDate("");
      setTimes("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Round name — e.g. Friday AM"
          className={`min-w-40 flex-1 ${inputClass}`}
        />
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
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
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          placeholder="Course — e.g. Eagles Landing"
          required
          className={`min-w-40 flex-1 ${inputClass}`}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch {
              // icon fallback
            }
          }}
          required
          className={`${inputClass} cursor-pointer [color-scheme:light] dark:[color-scheme:dark]`}
          aria-label="Round date"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={times}
          onChange={(e) => setTimes(e.target.value)}
          placeholder="Tee times — e.g. 8:32am, 8:40am"
          required
          className={`min-w-40 flex-1 ${inputClass}`}
        />
        <select
          value={partySize}
          onChange={(e) => setPartySize(e.target.value)}
          className={inputClass}
          aria-label="Spots per tee time"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} spots
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add round"}
        </button>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Creates one tee time per listed time, all under this round — no
        notification blast (use “Announce” once the schedule is set).
      </p>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}

/** "3:08pm" | "3:08 PM" | "15:08" → "15:08"; null when unparseable. */
function to24h(raw: string): string | null {
  const m = raw.toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2];
  const ampm = m[3];
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${min}`;
}
