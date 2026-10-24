"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const field =
  "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900";

export function VenueForm({
  venue,
  users,
}: {
  venue: {
    id: string;
    name: string;
    hostUserId: string | null;
    standingDay: number | null;
    standingTime: string | null;
  };
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [hostUserId, setHostUserId] = useState(venue.hostUserId ?? "");
  const [standingDay, setStandingDay] = useState(
    venue.standingDay == null ? "" : String(venue.standingDay)
  );
  const [standingTime, setStandingTime] = useState(venue.standingTime ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/sim-venues/${venue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostUserId: hostUserId || null,
        standingDay: standingDay === "" ? null : Number(standingDay),
        standingTime: standingDay === "" ? null : standingTime || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: "Saved" } : { ok: false, text: data.error || "Failed" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <form
      onSubmit={save}
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
    >
      <h2 className="font-semibold">🖥️ {venue.name}</h2>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
          Host
        </label>
        <select value={hostUserId} onChange={(e) => setHostUserId(e.target.value)} className={field}>
          <option value="">No host (books like a normal course)</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
            Standing night
          </label>
          <select
            value={standingDay}
            onChange={(e) => setStandingDay(e.target.value)}
            disabled={!hostUserId}
            className={field}
          >
            <option value="">None</option>
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
            Time
          </label>
          <input
            type="time"
            value={standingTime}
            onChange={(e) => setStandingTime(e.target.value)}
            disabled={!hostUserId || standingDay === ""}
            className={`${field} appearance-none`}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-300"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}
