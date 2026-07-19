"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type GameRow = {
  id: string;
  name: string;
  type: "CLOSEST_TO_PIN" | "LONG_DRIVE" | "CUSTOM";
  hole: number | null;
  roundId: string | null;
  roundLabel: string | null;
  payoutNote: string | null;
  winnerValue: string; // "p:<id>" | "t:<id>" | ""
  winnerName: string | null;
};

const TYPE_LABEL: Record<GameRow["type"], string> = {
  CLOSEST_TO_PIN: "Closest to pin",
  LONG_DRIVE: "Long drive",
  CUSTOM: "Prop",
};

const inputClass =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

export function GamesBoard({
  eventId,
  games,
  participants,
  teams,
  rounds,
  isAdmin,
}: {
  eventId: string;
  games: GameRow[];
  participants: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  rounds: { id: string; label: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({
    name: "",
    roundId: "",
    hole: "",
    payoutNote: "",
  });

  // Create form
  const [name, setName] = useState("");
  const [type, setType] = useState<GameRow["type"]>("CLOSEST_TO_PIN");
  const [roundId, setRoundId] = useState("");
  const [hole, setHole] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [adding, setAdding] = useState(false);

  async function addGame(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/event/${eventId}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, roundId, hole, payoutNote }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't add the game");
        return;
      }
      setName("");
      setHole("");
      setPayoutNote("");
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  async function setWinner(gameId: string, value: string) {
    setBusy(gameId);
    setError(null);
    try {
      const body = value.startsWith("p:")
        ? { winnerParticipantId: value.slice(2), winnerTeamId: null }
        : value.startsWith("t:")
        ? { winnerTeamId: value.slice(2), winnerParticipantId: null }
        : { winnerParticipantId: null, winnerTeamId: null };
      await fetch(`/api/event/${eventId}/games/${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit(gameId: string) {
    setBusy(gameId);
    setError(null);
    try {
      const res = await fetch(`/api/event/${eventId}/games/${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't save the game");
        return;
      }
      setEditingId(null);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function deleteGame(gameId: string) {
    if (confirmDelete !== gameId) {
      setConfirmDelete(gameId);
      return;
    }
    setBusy(gameId);
    try {
      await fetch(`/api/event/${eventId}/games/${gameId}`, {
        method: "DELETE",
      });
      setConfirmDelete(null);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {games.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No games yet — closest to the pin, long drive, or any prop you can
          think up.
        </p>
      ) : (
        <ul className="space-y-2">
          {games.map((g) =>
            editingId === g.id ? (
              <li
                key={g.id}
                className="space-y-2 rounded-lg border border-emerald-700/50 p-3 text-sm dark:border-emerald-500/40"
              >
                <div className="flex flex-wrap gap-2">
                  <input
                    value={edit.name}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                    placeholder="Game name"
                    className={`min-w-40 flex-1 ${inputClass}`}
                  />
                  <select
                    value={edit.roundId}
                    onChange={(e) =>
                      setEdit({ ...edit, roundId: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">Whole event</option>
                    {rounds.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={edit.hole}
                    onChange={(e) => setEdit({ ...edit, hole: e.target.value })}
                    inputMode="numeric"
                    placeholder="Hole"
                    className={`w-20 ${inputClass}`}
                  />
                  <input
                    value={edit.payoutNote}
                    onChange={(e) =>
                      setEdit({ ...edit, payoutNote: e.target.value })
                    }
                    placeholder="Stakes"
                    className={`min-w-28 flex-1 ${inputClass}`}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(g.id)}
                    disabled={busy === g.id || !edit.name.trim()}
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ) : (
            <li
              key={g.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-600"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {g.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {TYPE_LABEL[g.type]}
                  {g.roundLabel ? ` · ${g.roundLabel}` : ""}
                  {g.hole ? ` · hole ${g.hole}` : ""}
                  {g.payoutNote ? ` · ${g.payoutNote}` : ""}
                </p>
              </div>
              <select
                value={g.winnerValue}
                onChange={(e) => setWinner(g.id, e.target.value)}
                disabled={busy === g.id}
                aria-label={`Winner of ${g.name}`}
                className={`${inputClass} py-1.5 text-xs`}
              >
                <option value="">— winner —</option>
                <optgroup label="Players">
                  {participants.map((p) => (
                    <option key={p.id} value={`p:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
                {teams.length > 0 && (
                  <optgroup label="Teams">
                    {teams.map((t) => (
                      <option key={t.id} value={`t:${t.id}`}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {g.winnerName && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  🏅 {g.winnerName}
                </span>
              )}
              <button
                type="button"
                title={`Edit ${g.name}`}
                onClick={() => {
                  setEditingId(g.id);
                  setEdit({
                    name: g.name,
                    roundId: g.roundId ?? "",
                    hole: g.hole?.toString() ?? "",
                    payoutNote: g.payoutNote ?? "",
                  });
                }}
                disabled={busy === g.id}
                className="rounded-lg bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
              >
                ✏️
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => deleteGame(g.id)}
                  disabled={busy === g.id}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                    confirmDelete === g.id
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-gray-200 text-gray-500 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                  }`}
                >
                  {confirmDelete === g.id ? "Sure?" : "×"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addGame} className="space-y-2 rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-600">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Add a game
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name — e.g. CTP #7 Saturday"
            required
            className={`min-w-40 flex-1 ${inputClass}`}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as GameRow["type"])}
            className={inputClass}
          >
            <option value="CLOSEST_TO_PIN">Closest to pin</option>
            <option value="LONG_DRIVE">Long drive</option>
            <option value="CUSTOM">Custom prop</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={roundId}
            onChange={(e) => setRoundId(e.target.value)}
            className={`flex-1 ${inputClass}`}
          >
            <option value="">Whole event</option>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <input
            value={hole}
            onChange={(e) => setHole(e.target.value)}
            inputMode="numeric"
            placeholder="Hole"
            className={`w-20 ${inputClass}`}
          />
          <input
            value={payoutNote}
            onChange={(e) => setPayoutNote(e.target.value)}
            placeholder="Stakes — e.g. $5/man"
            className={`min-w-32 flex-1 ${inputClass}`}
          />
          <button
            type="submit"
            disabled={adding || !name.trim()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </form>
    </div>
  );
}
