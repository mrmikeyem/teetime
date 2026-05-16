"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinButton({
  teeTimeId,
  userId,
}: {
  teeTimeId: string;
  userId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    if (busy) return;
    setError("");
    setBusy(true);
    const res = await fetch(`/api/tee-times/${teeTimeId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't join");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {busy ? "Joining…" : "Join this group"}
      </button>
    </div>
  );
}
