"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The host's say-so on a hosted sim night. The host gets the on/off controls;
 * everyone else just sees where it stands.
 */
export function SimHostPanel({
  teeTimeId,
  status,
  hostName,
  isHost,
}: {
  teeTimeId: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  hostName: string;
  isHost: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function setOn(on: boolean) {
    if (busy) return;
    setError("");
    setBusy(true);
    const res = await fetch(`/api/tee-times/${teeTimeId}/sim-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "That didn't work");
    }
    setBusy(false);
    router.refresh();
  }

  const primary =
    "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";
  const secondary =
    "rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";

  if (!isHost) {
    if (status === "CONFIRMED") return null;
    return (
      <p
        className={`rounded-lg px-4 py-3 text-sm ${
          status === "PENDING"
            ? "bg-sky-50 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200"
            : "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300"
        }`}
      >
        {status === "PENDING"
          ? `🏠 Waiting on ${hostName} to say it's on. Join now and you'll hear the moment it is.`
          : `🏠 ${hostName} can't host this one, so it's off.`}
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-800 dark:bg-sky-900/20">
      {error && (
        <div className="rounded-md bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}
      {status === "PENDING" && (
        <>
          <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">
            🏠 Your place. Is it on?
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => setOn(true)} className={primary}>
              It&apos;s on
            </button>
            <button type="button" disabled={busy} onClick={() => setOn(false)} className={secondary}>
              Not this time
            </button>
            <Link href={`/tee-times/${teeTimeId}/edit`} className={secondary}>
              Change the time
            </Link>
          </div>
        </>
      )}
      {status === "CONFIRMED" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">
            🏠 You&apos;re hosting. It&apos;s on.
          </p>
          <button type="button" disabled={busy} onClick={() => setOn(false)} className={secondary}>
            Call it off
          </button>
        </div>
      )}
      {status === "CANCELLED" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">
            🏠 You called this one off.
          </p>
          <button type="button" disabled={busy} onClick={() => setOn(true)} className={primary}>
            Turn it back on
          </button>
        </div>
      )}
    </div>
  );
}
