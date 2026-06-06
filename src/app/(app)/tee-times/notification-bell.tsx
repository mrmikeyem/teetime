"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type FeedItem,
  type InlineAction,
  FeedRow,
  actionFlash,
  postAction,
  postDismiss,
  postReadAll,
} from "@/app/(app)/notifications/feed-shared";

export type { FeedItem };

export function NotificationBell({
  initialItems,
  initialUnread,
}: {
  initialItems: FeedItem[];
  initialUnread: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Overlays over always-fresh server props (set only in event handlers — no
  // setState/ref during render). `overrides` swaps an item after an inline
  // action; `dismissed` hides items; `clearedSig` records the props signature
  // at which the badge was optimistically cleared (re-shows when props change).
  const [overrides, setOverrides] = useState<Record<string, FeedItem>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [clearedSig, setClearedSig] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const propsSig = `${initialUnread}:${initialItems
    .map((i) => i.id + i.actionState + i.read)
    .join(",")}`;

  const items = initialItems
    .filter((i) => !dismissed.has(i.id))
    .map((i) => overrides[i.id] ?? i);

  const unread = clearedSig === propsSig ? 0 : initialUnread;

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

  function showFlash(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2500);
  }

  async function handleOpen() {
    setOpen(true);
    if (unread === 0) return;
    const ids = items.filter((i) => !i.read).map((i) => i.id);
    setClearedSig(propsSig);
    await postReadAll(ids);
    router.refresh();
  }

  async function markAllRead() {
    setClearedSig(propsSig);
    await postReadAll();
    router.refresh();
  }

  async function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    await postDismiss(id);
    router.refresh();
  }

  async function act(item: FeedItem, action: InlineAction) {
    setBusyId(item.id);
    const { ok, item: updated, error } = await postAction(item.id, action);
    if (updated) setOverrides((prev) => ({ ...prev, [item.id]: updated }));
    if (!ok) {
      showFlash(error ?? "That didn't work.");
    } else {
      showFlash(actionFlash(action));
      router.refresh();
    }
    setBusyId(null);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
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
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2 dark:border-gray-700">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Notifications
            </span>
            {items.some((i) => !i.read) && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
              >
                Mark all read
              </button>
            )}
          </div>

          {flash && (
            <div className="border-b border-gray-100 bg-emerald-50 px-4 py-1.5 text-xs text-emerald-800 dark:border-gray-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              {flash}
            </div>
          )}

          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700">
              {items.map((item) => (
                <FeedRow
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onAct={act}
                  onDismiss={dismiss}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </ul>
          )}

          <div className="border-t border-gray-100 px-4 py-2 text-center dark:border-gray-700">
            <a
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              See all
            </a>
          </div>
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
