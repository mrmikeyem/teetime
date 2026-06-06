"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type FeedItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string;
  read: boolean;
  createdAt: string; // ISO
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  return `${wk}w ago`;
}

export function NotificationBell({
  initialItems,
  initialUnread,
}: {
  initialItems: FeedItem[];
  initialUnread: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Optimistic clear on open. Reset whenever the server reports a different
  // unread count (a new notification arrived via router.refresh), so the
  // derived badge tracks server state without a setState-in-effect.
  const [clearedAt, setClearedAt] = useState<number | null>(null);
  const unread = clearedAt === initialUnread ? 0 : initialUnread;
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleOpen() {
    setOpen(true);
    if (unread === 0) return;
    // Mark exactly the items currently shown as read — a notification that
    // lands after this render keeps its unread state.
    const shownUnreadIds = initialItems
      .filter((i) => !i.read)
      .map((i) => i.id);
    setClearedAt(initialUnread);
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: shownUnreadIds }),
      });
      // Re-sync server state so the badge stays cleared across refreshes.
      router.refresh();
    } catch {
      // Leave the optimistic clear; next refresh reconciles.
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Notifications
          </div>
          {initialItems.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700">
              {initialItems.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.url}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      item.read ? "" : "bg-emerald-50/60 dark:bg-emerald-900/10"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {item.title}
                    </p>
                    <p className="truncate text-sm text-gray-600 dark:text-gray-300">
                      {item.body}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                      {relativeTime(item.createdAt)}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
