"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  type FeedItem,
  type InlineAction,
  FeedRow,
  actionFlash,
  postAction,
  postDismiss,
  postReadAll,
} from "./feed-shared";

export function FeedPageClient({ initialItems }: { initialItems: FeedItem[] }) {
  const router = useRouter();
  // Overlays layered over the (always-fresh) server props — set only in event
  // handlers, so no setState/ref during render. `overrides` swaps an item's
  // state after an inline action; `dismissed` hides items optimistically.
  const [overrides, setOverrides] = useState<Record<string, FeedItem>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const items = initialItems
    .filter((i) => !dismissed.has(i.id))
    .map((i) => overrides[i.id] ?? i);

  function showFlash(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2500);
  }

  async function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    await postDismiss(id);
    router.refresh();
  }

  async function markAllRead() {
    await postReadAll();
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
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2 dark:border-gray-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          All notifications
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
        <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          You&apos;re all caught up.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {items.map((item) => (
            <FeedRow
              key={item.id}
              item={item}
              busy={busyId === item.id}
              onAct={act}
              onDismiss={dismiss}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
