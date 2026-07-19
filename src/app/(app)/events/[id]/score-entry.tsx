"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TeamScore = {
  teamId: string;
  teamName: string;
  front9: number | null;
  back9: number | null;
};

const nineClass =
  "w-16 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-sm text-gray-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

export function ScoreEntry({
  eventId,
  roundId,
  teams,
}: {
  eventId: string;
  roundId: string;
  teams: TeamScore[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, { f: string; b: string }>>(
    Object.fromEntries(
      teams.map((t) => [
        t.teamId,
        { f: t.front9?.toString() ?? "", b: t.back9?.toString() ?? "" },
      ])
    )
  );
  const [savingTeam, setSavingTeam] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function dirty(t: TeamScore) {
    const v = values[t.teamId];
    return (
      v.f !== (t.front9?.toString() ?? "") || v.b !== (t.back9?.toString() ?? "")
    );
  }

  async function save(teamId: string) {
    const v = values[teamId];
    setSavingTeam(teamId);
    setError(null);
    try {
      const res = await fetch(`/api/event/${eventId}/scores`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId, teamId, front9: v.f, back9: v.b }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't save the score");
        return;
      }
      router.refresh();
    } finally {
      setSavingTeam(null);
    }
  }

  return (
    <div className="space-y-2">
      {teams.map((t) => {
        const v = values[t.teamId];
        const total =
          (Number.parseInt(v.f, 10) || 0) + (Number.parseInt(v.b, 10) || 0);
        return (
          <div key={t.teamId} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-semibold text-gray-800 dark:text-gray-200">
              {t.teamName}
            </span>
            <input
              value={v.f}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  [t.teamId]: { ...prev[t.teamId], f: e.target.value },
                }))
              }
              inputMode="numeric"
              placeholder="Front"
              aria-label={`${t.teamName} front nine`}
              className={nineClass}
            />
            <input
              value={v.b}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  [t.teamId]: { ...prev[t.teamId], b: e.target.value },
                }))
              }
              inputMode="numeric"
              placeholder="Back"
              aria-label={`${t.teamName} back nine`}
              className={nineClass}
            />
            <span className="w-8 text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {total > 0 ? total : "—"}
            </span>
            <button
              type="button"
              onClick={() => save(t.teamId)}
              disabled={savingTeam === t.teamId || !dirty(t)}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
            >
              {savingTeam === t.teamId ? "…" : "Save"}
            </button>
          </div>
        );
      })}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
