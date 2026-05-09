"use client";

import { useEffect, useRef, useState } from "react";

export type PickerItem =
  | { kind: "user"; id: string; name: string }
  | { kind: "guest"; id: string; name: string };

export function MemberPicker({
  excludeUserIds,
  excludeGuestIds,
  onPick,
}: {
  excludeUserIds: string[];
  excludeGuestIds: string[];
  onPick: (item: PickerItem) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [guests, setGuests] = useState<{ id: string; name: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const excludeUsersKey = excludeUserIds.join(",");
  const excludeGuestsKey = excludeGuestIds.join(",");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1) {
      setUsers([]);
      setGuests([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const params = new URLSearchParams({ q });
      if (excludeUsersKey) params.set("excludeUsers", excludeUsersKey);
      if (excludeGuestsKey) params.set("excludeGuests", excludeGuestsKey);
      const res = await fetch(`/api/users/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setGuests(data.guests);
      }
      setSearching(false);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, excludeUsersKey, excludeGuestsKey]);

  async function handlePick(item: PickerItem) {
    setError("");
    await onPick(item);
    setQuery("");
    setUsers([]);
    setGuests([]);
  }

  async function handleManualAdd() {
    if (adding) return;
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required");
      return;
    }
    setError("");
    setAdding(true);
    try {
      const res = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add");
        return;
      }
      const { guest } = await res.json();
      await onPick({ kind: "guest", id: guest.id, name: guest.name });
      setFirstName("");
      setLastName("");
    } finally {
      setAdding(false);
    }
  }

  const totalResults = users.length + guests.length;

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name..."
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
        />
        {query.trim().length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-md">
            {searching && (
              <li className="px-3 py-2 text-xs text-gray-500">Searching…</li>
            )}
            {!searching && totalResults === 0 && (
              <li className="px-3 py-2 text-xs text-gray-500">
                No matches. Add manually below.
              </li>
            )}
            {users.map((u) => (
              <li key={`u-${u.id}`}>
                <button
                  type="button"
                  onClick={() => handlePick({ kind: "user", id: u.id, name: u.name })}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-emerald-50"
                >
                  <span>{u.name}</span>
                </button>
              </li>
            ))}
            {guests.map((g) => (
              <li key={`g-${g.id}`}>
                <button
                  type="button"
                  onClick={() => handlePick({ kind: "guest", id: g.id, name: g.name })}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-emerald-50"
                >
                  <span>{g.name}</span>
                  <span className="text-xs text-gray-400">guest</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {!showManual ? (
        <button
          type="button"
          onClick={() => setShowManual(true)}
          className="text-xs text-emerald-700 hover:underline"
        >
          + Add new person manually
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleManualAdd();
                }
              }}
              placeholder="First"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleManualAdd();
                }
              }}
              placeholder="Last"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleManualAdd()}
              disabled={adding}
              className="flex-1 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowManual(false);
                setError("");
              }}
              className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
