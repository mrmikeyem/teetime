"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Member = { id: string; name: string };

type Player = {
  key: string;
  name: string;
  handicap: string; // raw input, optional
  captain: boolean;
  memberId?: string;
};

type Mode = "random" | "balanced" | "captains";

type Team = {
  label: string;
  players: {
    name: string;
    handicap: number | null;
    captain: boolean;
    memberId?: string;
  }[];
  avg: number | null;
};

const MODES: { value: Mode; label: string; hint: string }[] = [
  {
    value: "random",
    label: "Random",
    hint: "Pure shuffle — everyone into the hat.",
  },
  {
    value: "balanced",
    label: "Balanced",
    hint: "Uses handicaps to keep team averages as even as possible.",
  },
  {
    value: "captains",
    label: "Captains",
    hint: "Mark a captain per team, then fill the rest randomly or by handicap.",
  },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function teamSizes(playerCount: number, numTeams: number): number[] {
  const base = Math.floor(playerCount / numTeams);
  const extra = playerCount % numTeams;
  return Array.from({ length: numTeams }, (_, i) => base + (i < extra ? 1 : 0));
}

function parseHandicap(raw: string): number | null {
  const n = Number.parseFloat(raw.trim());
  return Number.isFinite(n) ? n : null;
}

export function TeamGenerator({
  members,
  saveTarget = null,
  initialMemberIds = [],
}: {
  members: Member[];
  saveTarget?: { eventId: string; eventName: string } | null;
  initialMemberIds?: string[];
}) {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>(() =>
    members
      .filter((m) => initialMemberIds.includes(m.id))
      .map((m) => ({
        key: `member-${m.id}`,
        name: m.name,
        handicap: "",
        captain: false,
        memberId: m.id,
      }))
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [mode, setMode] = useState<Mode>("random");
  const [sizing, setSizing] = useState<"size" | "count">("size");
  const [sizeInput, setSizeInput] = useState("2");
  const [countInput, setCountInput] = useState("2");
  const [captainFill, setCaptainFill] = useState<"random" | "balanced">(
    "random"
  );
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const guestSeq = useRef(0);

  function toggleMember(m: Member) {
    setPlayers((prev) => {
      const existing = prev.find((p) => p.memberId === m.id);
      if (existing) return prev.filter((p) => p !== existing);
      return [
        ...prev,
        {
          key: `member-${m.id}`,
          name: m.name,
          handicap: "",
          captain: false,
          memberId: m.id,
        },
      ];
    });
  }

  function addGuest() {
    const name = guestName.trim();
    if (!name) return;
    guestSeq.current += 1;
    setPlayers((prev) => [
      ...prev,
      { key: `guest-${guestSeq.current}`, name, handicap: "", captain: false },
    ]);
    setGuestName("");
  }

  function updatePlayer(key: string, patch: Partial<Player>) {
    setPlayers((prev) =>
      prev.map((p) => (p.key === key ? { ...p, ...patch } : p))
    );
  }

  function removePlayer(key: string) {
    setPlayers((prev) => prev.filter((p) => p.key !== key));
  }

  function generate() {
    setError(null);
    setCopied(false);

    const roster = players;
    if (roster.length < 2) {
      setError("Add at least two players.");
      return;
    }

    // Effective handicap: blank entries count as the average of what was
    // entered, so a missing number doesn't skew balanced teams.
    const entered = roster
      .map((p) => parseHandicap(p.handicap))
      .filter((n): n is number => n !== null);
    const fallback =
      entered.length > 0
        ? entered.reduce((a, b) => a + b, 0) / entered.length
        : 0;
    const effective = (p: Player) => parseHandicap(p.handicap) ?? fallback;
    const anyHandicaps = entered.length > 0;

    const buildTeam = (
      label: string,
      group: Player[],
      showAvg: boolean
    ): Team => ({
      label,
      players: group.map((p) => ({
        name: p.name,
        handicap: parseHandicap(p.handicap),
        captain: p.captain,
        memberId: p.memberId,
      })),
      avg: showAvg
        ? group.reduce((sum, p) => sum + effective(p), 0) / group.length
        : null,
    });

    const spread = (groups: Player[][]) => {
      const avgs = groups.map(
        (g) => g.reduce((sum, p) => sum + effective(p), 0) / g.length
      );
      return Math.max(...avgs) - Math.min(...avgs);
    };

    const partition = (pool: Player[], sizes: number[]) => {
      const groups: Player[][] = [];
      let i = 0;
      for (const s of sizes) {
        groups.push(pool.slice(i, i + s));
        i += s;
      }
      return groups;
    };

    if (mode === "captains") {
      const captains = roster.filter((p) => p.captain);
      if (captains.length < 2) {
        setError("Mark at least two captains (tap the C next to a name).");
        return;
      }
      const pool = roster.filter((p) => !p.captain);
      // Captain slot counts toward the team size.
      const fillSizes = teamSizes(roster.length, captains.length).map(
        (s) => s - 1
      );

      let bestCaptains = shuffle(captains);
      let bestPool = shuffle(pool);
      if (captainFill === "balanced" && anyHandicaps) {
        let bestSpread = Infinity;
        for (let iter = 0; iter < 400; iter++) {
          const caps = shuffle(captains);
          const rest = shuffle(pool);
          const groups = partition(rest, fillSizes).map((g, i) => [
            caps[i],
            ...g,
          ]);
          const s = spread(groups);
          if (s < bestSpread) {
            bestSpread = s;
            bestCaptains = caps;
            bestPool = rest;
          }
        }
      }
      const groups = partition(bestPool, fillSizes).map((g, i) => [
        bestCaptains[i],
        ...g,
      ]);
      setTeams(
        groups.map((g, i) =>
          buildTeam(`Team ${bestCaptains[i].name}`, g, anyHandicaps)
        )
      );
      return;
    }

    let numTeams: number;
    if (sizing === "size") {
      const size = Number.parseInt(sizeInput, 10);
      if (!Number.isFinite(size) || size < 1) {
        setError("Enter a team size of at least 1.");
        return;
      }
      numTeams = Math.ceil(roster.length / size);
    } else {
      numTeams = Number.parseInt(countInput, 10);
      if (!Number.isFinite(numTeams) || numTeams < 2) {
        setError("Enter at least 2 teams.");
        return;
      }
    }
    if (numTeams < 2) {
      setError("That team size puts everyone on one team.");
      return;
    }
    if (numTeams > roster.length) {
      setError("More teams than players — add players or shrink the count.");
      return;
    }

    const sizes = teamSizes(roster.length, numTeams);

    let best = partition(shuffle(roster), sizes);
    if (mode === "balanced" && anyHandicaps) {
      let bestSpread = Infinity;
      for (let iter = 0; iter < 400; iter++) {
        const groups = partition(shuffle(roster), sizes);
        const s = spread(groups);
        if (s < bestSpread) {
          bestSpread = s;
          best = groups;
        }
      }
    }
    setTeams(
      best.map((g, i) => buildTeam(`Team ${i + 1}`, g, anyHandicaps))
    );
  }

  async function saveToEvent() {
    if (!teams || !saveTarget) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(
        `/api/event/${saveTarget.eventId}/teams/bulk`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teams: teams.map((t) => ({
              name: t.label,
              userIds: t.players
                .map((p) => p.memberId)
                .filter((id): id is string => !!id),
            })),
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error ?? "Couldn't save the teams");
        return;
      }
      router.push(`/events/${saveTarget.eventId}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function copyTeams() {
    if (!teams) return;
    const text = teams
      .map((t) => {
        const header =
          t.avg !== null ? `${t.label} (avg ${t.avg.toFixed(1)})` : t.label;
        const names = t.players
          .map(
            (p) =>
              `${p.captain ? "©" : "-"} ${p.name}${
                p.handicap !== null ? ` (${p.handicap})` : ""
              }`
          )
          .join("\n");
        return `${header}\n${names}`;
      })
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(`⛳ Teams\n\n${text}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy — select and copy the teams manually.");
    }
  }

  const inputClass =
    "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";
  const chipOff =
    "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600";
  const chipOn = "border-emerald-700 bg-emerald-700 text-white";

  return (
    <div className="space-y-4">
      {/* Roster */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Members
          </p>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const active = players.some((p) => p.memberId === m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMember(m)}
                  aria-pressed={active}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    active ? chipOn : chipOff
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Add anyone else
          </p>
          <div className="flex gap-2">
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addGuest();
                }
              }}
              placeholder="Guest name"
              className={`flex-1 ${inputClass}`}
            />
            <button
              type="button"
              onClick={addGuest}
              disabled={!guestName.trim()}
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Add
            </button>
          </div>
        </div>

        {players.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Roster ({players.length})
            </p>
            <ul className="space-y-2">
              {players.map((p) => (
                <li key={p.key} className="flex items-center gap-2">
                  {mode === "captains" && (
                    <button
                      type="button"
                      onClick={() =>
                        updatePlayer(p.key, { captain: !p.captain })
                      }
                      aria-pressed={p.captain}
                      title={p.captain ? "Remove captain" : "Make captain"}
                      className={`h-8 w-8 shrink-0 rounded-lg border text-sm font-bold ${
                        p.captain ? chipOn : chipOff
                      }`}
                    >
                      C
                    </button>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">
                    {p.name}
                  </span>
                  {(mode === "balanced" ||
                    (mode === "captains" && captainFill === "balanced")) && (
                    <input
                      value={p.handicap}
                      onChange={(e) =>
                        updatePlayer(p.key, { handicap: e.target.value })
                      }
                      inputMode="decimal"
                      placeholder="Hcp"
                      className={`w-16 text-center ${inputClass}`}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removePlayer(p.key)}
                    title="Remove"
                    className="h-8 w-8 shrink-0 rounded-lg bg-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Settings */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            How should teams be made?
          </p>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                aria-pressed={mode === m.value}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  mode === m.value ? chipOn : chipOff
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {MODES.find((m) => m.value === mode)?.hint}
          </p>
        </div>

        {mode !== "captains" ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={() => setSizing("size")}
                aria-pressed={sizing === "size"}
                className={`px-3 py-2 text-xs font-semibold ${
                  sizing === "size"
                    ? "bg-emerald-700 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                Players per team
              </button>
              <button
                type="button"
                onClick={() => setSizing("count")}
                aria-pressed={sizing === "count"}
                className={`px-3 py-2 text-xs font-semibold ${
                  sizing === "count"
                    ? "bg-emerald-700 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                Number of teams
              </button>
            </div>
            <input
              value={sizing === "size" ? sizeInput : countInput}
              onChange={(e) =>
                sizing === "size"
                  ? setSizeInput(e.target.value)
                  : setCountInput(e.target.value)
              }
              inputMode="numeric"
              className={`w-16 text-center ${inputClass}`}
            />
          </div>
        ) : (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Fill the rest
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCaptainFill("random")}
                aria-pressed={captainFill === "random"}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  captainFill === "random" ? chipOn : chipOff
                }`}
              >
                Randomly
              </button>
              <button
                type="button"
                onClick={() => setCaptainFill("balanced")}
                aria-pressed={captainFill === "balanced"}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  captainFill === "balanced" ? chipOn : chipOff
                }`}
              >
                Balanced by handicap
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              One team per captain — {players.filter((p) => p.captain).length}{" "}
              marked so far.
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="button"
          onClick={generate}
          disabled={players.length < 2}
          className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {teams ? "🎲 Re-roll teams" : "🎲 Generate teams"}
        </button>
      </section>

      {/* Results */}
      {teams && (
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Teams
            </p>
            <button
              type="button"
              onClick={copyTeams}
              className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              {copied ? "Copied ✓" : "Copy for group chat"}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((t) => (
              <div
                key={t.label}
                className="rounded-lg border border-gray-200 p-4 dark:border-gray-600"
              >
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {t.label}
                  {t.avg !== null && (
                    <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                      avg {t.avg.toFixed(1)}
                    </span>
                  )}
                </p>
                <ul className="mt-2 space-y-1">
                  {t.players.map((p, i) => (
                    <li
                      key={i}
                      className="text-sm text-gray-700 dark:text-gray-200"
                    >
                      {p.captain && (
                        <span className="mr-1 font-bold text-emerald-700 dark:text-emerald-400">
                          ©
                        </span>
                      )}
                      {p.name}
                      {p.handicap !== null && (
                        <span className="text-gray-400 dark:text-gray-500">
                          {" "}
                          ({p.handicap})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {saveTarget && (
            <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700">
              {teams.some((t) => t.players.some((p) => !p.memberId)) && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ Ad-hoc guests without an account can&apos;t be saved to
                  the event — they&apos;ll be skipped. Invite them as event
                  users first if they should count.
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Saving replaces {saveTarget.eventName}&apos;s current teams
                (and any scores already entered against them).
              </p>
              <button
                type="button"
                onClick={saveToEvent}
                disabled={saving}
                className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving
                  ? "Saving…"
                  : `💾 Save these teams to ${saveTarget.eventName}`}
              </button>
              {saveError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {saveError}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
