"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function DeleteButton({ teeTimeId }: { teeTimeId: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleClick() {
    if (busy) return;
    if (!armed) {
      setArmed(true);
      timerRef.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    void doDelete();
  }

  async function doDelete() {
    setBusy(true);
    const res = await fetch(`/api/tee-times/${teeTimeId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.push("/tee-times");
      router.refresh();
    } else {
      setBusy(false);
      setArmed(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
        armed
          ? "bg-red-600 text-white hover:bg-red-700"
          : "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600"
      }`}
    >
      {busy ? "Deleting…" : armed ? "Tap again to confirm" : "Delete tee time"}
    </button>
  );
}
