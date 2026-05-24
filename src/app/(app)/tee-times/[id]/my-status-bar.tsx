"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MyStatusBar({
  teeTimeId,
  userId,
  confirmed,
  isTournament,
}: {
  teeTimeId: string;
  userId: string;
  confirmed: boolean;
  isTournament: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // Optimistic local confirm state so the "I'm in" pill flips immediately.
  // router.refresh re-fetches the server tree; AutoRefresh polling reconciles
  // with other clients.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const effective = optimistic ?? confirmed;

  async function confirm() {
    if (busy || effective) return;
    setOptimistic(true);
    setBusy(true);
    try {
      const res = await fetch(`/api/tee-times/${teeTimeId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, confirmed: true }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        setOptimistic(confirmed);
      }
    } catch {
      setOptimistic(confirmed);
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (busy) return;
    const ok = window.confirm(
      isTournament
        ? "Remove yourself from this tournament? Other players will be notified."
        : "Remove yourself from this tee time? Other players will be notified."
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tee-times/${teeTimeId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = effective
    ? isTournament
      ? "You're playing"
      : "You're in"
    : "You haven't confirmed yet";

  return (
    <section
      aria-label="Your status"
      className={`rounded-lg border p-3 ${
        effective
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/20"
          : "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20"
      }`}
    >
      <p
        className={`text-sm font-semibold ${
          effective
            ? "text-emerald-800 dark:text-emerald-200"
            : "text-amber-800 dark:text-amber-200"
        }`}
      >
        {effective ? "✓ " : "• "}
        {statusLabel}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={busy || effective}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            effective
              ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100 cursor-default"
              : "bg-emerald-700 text-white hover:bg-emerald-800"
          } disabled:opacity-60`}
        >
          {effective ? "✓ I'm in" : "I'm in"}
        </button>
        <button
          type="button"
          onClick={leave}
          disabled={busy}
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:hover:border-red-900/60 dark:hover:bg-red-900/30 dark:hover:text-red-300 disabled:opacity-60"
        >
          Can&apos;t make it
        </button>
      </div>
    </section>
  );
}
