"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

/**
 * Admin panel for the Teams section: create/delete teams, add/remove
 * participants, and set each participant's event-level default team.
 */
export function TeamsManager({
  eventId,
  teams,
  participants,
  addableUsers,
}: {
  eventId: string;
  teams: { id: string; name: string }[];
  participants: { id: string; name: string; teamId: string | null }[];
  addableUsers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  async function call(path: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Assign default teams */}
      {participants.length > 0 && (
        <ul className="space-y-1.5">
          {participants.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-200">
                {p.name}
              </span>
              <select
                value={p.teamId ?? ""}
                onChange={(e) =>
                  call(`/api/event/${eventId}/participants/${p.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ teamId: e.target.value || null }),
                  })
                }
                disabled={busy || teams.length === 0}
                aria-label={`Team for ${p.name}`}
                className={`${inputClass} py-1.5 text-xs`}
              >
                <option value="">Unassigned</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                title={`Remove ${p.name} from the event`}
                onClick={() =>
                  call(`/api/event/${eventId}/participants/${p.id}`, {
                    method: "DELETE",
                  })
                }
                disabled={busy}
                className="h-7 w-7 rounded-lg bg-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Create / delete teams */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="New team name"
            className={`flex-1 ${inputClass}`}
          />
          <button
            type="button"
            disabled={busy || !teamName.trim()}
            onClick={async () => {
              const ok = await call(`/api/event/${eventId}/teams`, {
                method: "POST",
                body: JSON.stringify({ name: teamName }),
              });
              if (ok) setTeamName("");
            }}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            Add team
          </button>
        </div>
        {teams.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {teams.map((t) =>
              renamingId === t.id ? (
                <span key={t.id} className="flex items-center gap-1">
                  <input
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    autoFocus
                    className={`w-36 ${inputClass} py-1 text-xs`}
                  />
                  <button
                    type="button"
                    disabled={busy || !renameDraft.trim()}
                    onClick={async () => {
                      const ok = await call(
                        `/api/event/${eventId}/teams/${t.id}`,
                        {
                          method: "PATCH",
                          body: JSON.stringify({ name: renameDraft }),
                        }
                      );
                      if (ok) setRenamingId(null);
                    }}
                    className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    className="rounded-lg bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <span
                  key={t.id}
                  className="flex items-center overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <button
                    type="button"
                    title={`Rename ${t.name}`}
                    onClick={() => {
                      setRenamingId(t.id);
                      setRenameDraft(t.name);
                    }}
                    disabled={busy}
                    className="bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    ✏️ {t.name}
                  </button>
                  <button
                    type="button"
                    title={`Delete ${t.name}`}
                    onClick={() => {
                      if (confirmDeleteTeam !== t.id) {
                        setConfirmDeleteTeam(t.id);
                        return;
                      }
                      call(`/api/event/${eventId}/teams/${t.id}`, {
                        method: "DELETE",
                      }).then(() => setConfirmDeleteTeam(null));
                    }}
                    onBlur={() => setConfirmDeleteTeam(null)}
                    disabled={busy}
                    className={`px-2 py-1 text-xs font-semibold ${
                      confirmDeleteTeam === t.id
                        ? "bg-red-600 text-white"
                        : "bg-white text-gray-400 hover:bg-gray-50 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                    }`}
                  >
                    {confirmDeleteTeam === t.id ? "Sure?" : "×"}
                  </button>
                </span>
              )
            )}
          </div>
        )}
      </div>

      {/* Add participants */}
      {addableUsers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Add players
          </p>
          <div className="flex flex-wrap gap-2">
            {addableUsers.map((u) => {
              const active = selectedUsers.has(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setSelectedUsers((prev) => {
                      const next = new Set(prev);
                      if (next.has(u.id)) next.delete(u.id);
                      else next.add(u.id);
                      return next;
                    })
                  }
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                    active
                      ? "border-emerald-700 bg-emerald-700 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {u.name}
                </button>
              );
            })}
          </div>
          {selectedUsers.size > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const ok = await call(`/api/event/${eventId}/participants`, {
                  method: "POST",
                  body: JSON.stringify({ userIds: Array.from(selectedUsers) }),
                });
                if (ok) setSelectedUsers(new Set());
              }}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Add {selectedUsers.size} to event
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
