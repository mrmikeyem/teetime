"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MemberRow({
  teeTimeId,
  memberKind,
  memberId,
  name,
  isGuest,
  confirmed,
  addedByLabel,
}: {
  teeTimeId: string;
  memberKind: "user" | "guest";
  memberId: string;
  name: string;
  isGuest: boolean;
  confirmed: boolean;
  addedByLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function bodyForId() {
    return memberKind === "user"
      ? { userId: memberId }
      : { guestId: memberId };
  }

  async function toggleConfirmed() {
    setBusy(true);
    const res = await fetch(`/api/tee-times/${teeTimeId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...bodyForId(), confirmed: !confirmed }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function remove() {
    const ok = window.confirm(
      `Remove ${name} from this tee time? Other players will be notified.`
    );
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/tee-times/${teeTimeId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyForId()),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{name}</span>
          {isGuest && (
            <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              guest
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">added by {addedByLabel}</div>
      </div>
      <button
        type="button"
        onClick={toggleConfirmed}
        disabled={busy}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
          confirmed
            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200"
            : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
        }`}
      >
        {confirmed ? "Confirmed" : "Pending"}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        aria-label={`Remove ${name}`}
        className="flex h-9 w-9 items-center justify-center rounded-md text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-300 disabled:opacity-50"
      >
        ✕
      </button>
    </li>
  );
}
