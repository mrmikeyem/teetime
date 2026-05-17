"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MemberPicker, type PickerItem } from "../member-picker";

export function AddMember({
  teeTimeId,
  excludeUserIds,
  excludeGuestIds,
}: {
  teeTimeId: string;
  excludeUserIds: string[];
  excludeGuestIds: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function handlePick(item: PickerItem) {
    setError("");
    const body =
      item.kind === "user" ? { userId: item.id } : { guestId: item.id };

    const res = await fetch(`/api/tee-times/${teeTimeId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Add someone
      </h2>
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-2 text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}
      <MemberPicker
        excludeUserIds={excludeUserIds}
        excludeGuestIds={excludeGuestIds}
        onPick={handlePick}
      />
    </div>
  );
}
