"use client";

// Shared client pieces for the notification feed, used by both the bell
// dropdown (tee-times/notification-bell.tsx) and the /notifications page.

export type FeedItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string;
  read: boolean;
  createdAt: string; // ISO
  teeTimeId: string | null;
  actionState:
    | "confirmable"
    | "confirmed"
    | "joinable"
    | "full"
    | "already_on"
    | "past"
    | "gone"
    | "none";
};

export type InlineAction = "confirm" | "decline" | "join";

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return `${Math.round(day / 7)}w ago`;
}

/** Shared action calls. Each returns the refreshed item (or null on failure). */
export async function postAction(
  notificationId: string,
  action: InlineAction
): Promise<{ ok: boolean; item: FeedItem | null; error?: string }> {
  try {
    const res = await fetch("/api/notifications/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notificationId }),
    });
    const data = await res.json();
    return { ok: res.ok, item: data.item ?? null, error: data.error };
  } catch {
    return { ok: false, item: null, error: "Network error." };
  }
}

export async function postDismiss(id: string): Promise<void> {
  try {
    await fetch("/api/notifications/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  } catch {
    /* optimistic */
  }
}

export async function postReadAll(ids?: string[]): Promise<void> {
  try {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
    });
  } catch {
    /* optimistic */
  }
}

export function FeedRow({
  item,
  busy,
  onAct,
  onDismiss,
  onNavigate,
}: {
  item: FeedItem;
  busy: boolean;
  onAct: (item: FeedItem, action: InlineAction) => void;
  onDismiss: (id: string) => void;
  onNavigate?: () => void;
}) {
  return (
    <li
      className={`group relative px-4 py-3 ${
        item.read ? "" : "bg-emerald-50/60 dark:bg-emerald-900/10"
      }`}
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(item.id)}
        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded text-gray-400 opacity-0 hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        ✕
      </button>

      <a href={item.url} onClick={onNavigate} className="block pr-5">
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

      <ActionRow item={item} busy={busy} onAct={onAct} />
    </li>
  );
}

function ActionRow({
  item,
  busy,
  onAct,
}: {
  item: FeedItem;
  busy: boolean;
  onAct: (item: FeedItem, action: InlineAction) => void;
}) {
  const btn = "rounded-md px-2.5 py-1 text-xs font-semibold disabled:opacity-50";

  switch (item.actionState) {
    case "confirmable":
      return (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAct(item, "confirm")}
            className={`${btn} bg-emerald-700 text-white hover:bg-emerald-800`}
          >
            Confirm
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAct(item, "decline")}
            className={`${btn} bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600`}
          >
            Decline
          </button>
        </div>
      );
    case "joinable":
      return (
        <div className="mt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAct(item, "join")}
            className={`${btn} bg-emerald-700 text-white hover:bg-emerald-800`}
          >
            Join
          </button>
        </div>
      );
    case "confirmed":
      return <StatusPill>Confirmed ✓</StatusPill>;
    case "already_on":
      return <StatusPill>You&apos;re in ✓</StatusPill>;
    case "full":
      return <StatusPill muted>Full</StatusPill>;
    case "past":
      return <StatusPill muted>Past</StatusPill>;
    case "gone":
      return <StatusPill muted>No longer available</StatusPill>;
    default:
      return null;
  }
}

function StatusPill({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={`mt-2 inline-block text-xs font-medium ${
        muted
          ? "text-gray-400 dark:text-gray-500"
          : "text-emerald-700 dark:text-emerald-400"
      }`}
    >
      {children}
    </span>
  );
}
