"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MemberPicker, type PickerUser } from "../member-picker";

export function AddMember({
  teeTimeId,
  excludeIds,
}: {
  teeTimeId: string;
  excludeIds: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function handlePick(user: PickerUser) {
    setError("");
    const res = await fetch(`/api/tee-times/${teeTimeId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to add");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Add someone
      </h2>
      {error && (
        <div className="rounded-md bg-red-50 p-2 text-xs text-red-600">
          {error}
        </div>
      )}
      <MemberPicker excludeIds={excludeIds} onPick={handlePick} />
    </div>
  );
}
