"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type BoardPlayer = {
  participantId: string;
  name: string;
  teamName: string | null;
  overrideTeamId: string | null;
  mulliFront: boolean;
  mulliBack: boolean;
  driveUsed: boolean;
};

type Toggle = "mulliFront" | "mulliBack" | "driveUsed";

const TOGGLES: { key: Toggle; label: string; title: string }[] = [
  { key: "mulliFront", label: "M1", title: "Front-nine mulligan used" },
  { key: "mulliBack", label: "M2", title: "Back-nine mulligan used" },
  { key: "driveUsed", label: "D", title: "Drive used this round" },
];

/**
 * The honesty board: per player per round — front/back mulligan burned,
 * drive requirement met. Admins additionally get a per-round team override
 * select (rotating-team formats like cart scrambles).
 */
export function MulliganBoard({
  eventId,
  roundId,
  players,
  teams,
  isAdmin,
}: {
  eventId: string;
  roundId: string;
  players: BoardPlayer[];
  teams: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function put(participantId: string, patch: Record<string, unknown>) {
    setBusy(participantId);
    try {
      await fetch(`/api/event/${eventId}/rounds/${roundId}/players`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, ...patch }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="space-y-1.5">
      {players.map((p) => (
        <li key={p.participantId} className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-200">
            {p.name}
            {p.teamName && (
              <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                · {p.teamName}
              </span>
            )}
          </span>
          {isAdmin && teams.length > 0 && (
            <select
              value={p.overrideTeamId ?? ""}
              onChange={(e) =>
                put(p.participantId, { teamId: e.target.value || null })
              }
              disabled={busy === p.participantId}
              title="Team for this round only (overrides the event team)"
              className="rounded-lg border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
            >
              <option value="">event team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {TOGGLES.map(({ key, label, title }) => (
            <button
              key={key}
              type="button"
              title={title}
              aria-pressed={p[key]}
              disabled={busy === p.participantId}
              onClick={() => put(p.participantId, { [key]: !p[key] })}
              className={`h-7 w-8 rounded-lg border text-xs font-bold disabled:opacity-50 ${
                p[key]
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </li>
      ))}
    </ul>
  );
}
