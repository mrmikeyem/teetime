"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefreshForecast({
  teeTimeId,
  ageMin,
}: {
  teeTimeId: string;
  ageMin: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const ageLabel =
    ageMin < 1
      ? "just now"
      : ageMin < 60
        ? `${ageMin} min ago`
        : `${Math.round(ageMin / 60)}h ago`;

  async function refresh() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/weather/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teeTimeId }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <p className="mt-2 text-xs text-sky-700/70 dark:text-sky-300/70">
      Updated {ageLabel}
      {ageMin >= 30 && (
        <>
          {" · "}
          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            className="font-semibold underline underline-offset-2 hover:text-sky-900 disabled:opacity-50 dark:hover:text-sky-100"
          >
            {busy ? "Refreshing…" : "Refresh forecast"}
          </button>
        </>
      )}
    </p>
  );
}
