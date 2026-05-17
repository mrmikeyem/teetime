"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type UserRowProps = {
  user: {
    id: string;
    username: string;
    name: string;
    email: string | null;
    role: "BASIC" | "ADMIN";
    lastLoginAt: string | null;
    createdAt: string;
    teeTimeCount: number;
  };
  isSelf: boolean;
};

export function UserRow({ user, isSelf }: UserRowProps) {
  const router = useRouter();
  const [role, setRole] = useState(user.role);
  const [roleBusy, setRoleBusy] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function changeRole(next: "BASIC" | "ADMIN") {
    if (next === role || roleBusy) return;
    setError("");
    setRoleBusy(true);
    const res = await fetch(`/api/admin/users/${user.id}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: next }),
    });
    setRoleBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't change role");
      return;
    }
    setRole(next);
    router.refresh();
  }

  async function handleDelete() {
    if (deleting) return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      setTimeout(() => setDeleteArmed(false), 4000);
      return;
    }
    setError("");
    setDeleting(true);
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't delete");
      setDeleting(false);
      setDeleteArmed(false);
    }
  }

  return (
    <li
      className={`rounded-lg border p-3 shadow-sm ${
        isSelf ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/30" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{user.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                role === "ADMIN"
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              }`}
            >
              {role.toLowerCase()}
            </span>
            {isSelf && (
              <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-white">
                you
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
            <span className="font-mono">{user.username}</span>
            {user.email && <> · {user.email}</>}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Last login: {formatDate(user.lastLoginAt)}
            {" · "}
            Joined: {formatDate(user.createdAt)}
            {" · "}
            {user.teeTimeCount} tee time{user.teeTimeCount === 1 ? "" : "s"}
          </p>
        </div>
        {!isSelf && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={role}
              disabled={roleBusy}
              onChange={(e) => changeRole(e.target.value as "BASIC" | "ADMIN")}
              className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs disabled:opacity-50"
            >
              <option value="BASIC">basic</option>
              <option value="ADMIN">admin</option>
            </select>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${
                deleteArmed
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-300"
              }`}
            >
              {deleting
                ? "Deleting…"
                : deleteArmed
                ? "Tap to confirm"
                : "Delete"}
            </button>
          </div>
        )}
      </div>
      {error && (
        <div className="mt-2 rounded-md bg-red-50 dark:bg-red-900/30 p-2 text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}
    </li>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "never";
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
}
