"use client";

import { useEffect, useRef, useState } from "react";

export type PickerUser = { id: string; name: string; isStub: boolean };

export function MemberPicker({
  excludeIds,
  onPick,
}: {
  excludeIds: string[];
  onPick: (user: PickerUser) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const excludeKey = excludeIds.join(",");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const params = new URLSearchParams({ q });
      if (excludeKey) params.set("exclude", excludeKey);
      const res = await fetch(`/api/users/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.users);
      }
      setSearching(false);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, excludeKey]);

  async function handlePick(user: PickerUser) {
    setError("");
    await onPick(user);
    setQuery("");
    setResults([]);
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
      const res = await fetch("/api/users/stub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add");
        return;
      }
      const { user } = await res.json();
      await onPick(user);
      setFirstName("");
      setLastName("");
    } finally {
      setAdding(false);
    }
  }

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
            {!searching && results.length === 0 && (
              <li className="px-3 py-2 text-xs text-gray-500">
                No matches. Add manually below.
              </li>
            )}
            {results.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => handlePick(u)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-emerald-50"
                >
                  <span>{u.name}</span>
                  {u.isStub && (
                    <span className="text-xs text-gray-400">guest</span>
                  )}
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
