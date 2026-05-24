"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type State =
  | "loading"
  | "unsupported"
  | "blocked"
  | "missing-vapid"
  | "subscribed"
  | "unsubscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const b64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export function PushNotifications() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (!VAPID_PUBLIC_KEY) {
        if (!cancelled) setState("missing-vapid");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("blocked");
        return;
      }
      const reg = await getRegistration();
      if (!reg) {
        if (!cancelled) setState("unsupported");
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      if (!cancelled) setState(sub ? "subscribed" : "unsubscribed");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setError("");
    try {
      const reg = await getRegistration();
      if (!reg) {
        setError("Service worker unavailable.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "unsubscribed");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          VAPID_PUBLIC_KEY
        ) as BufferSource,
      });
      const res = await fetch("/api/profile/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        setError("Couldn't save subscription on the server.");
        await sub.unsubscribe().catch(() => {});
        return;
      }
      setState("subscribed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError("");
    try {
      const reg = await getRegistration();
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/profile/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe().catch(() => {});
      }
      setState("unsubscribed");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400">Checking…</p>
    );
  }

  if (state === "unsupported") {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Push notifications aren&apos;t supported in this browser. On iPhone or
        iPad, add the app to your home screen first, then come back here.
      </p>
    );
  }

  if (state === "missing-vapid") {
    return (
      <p className="text-sm text-red-600 dark:text-red-300">
        Push notifications aren&apos;t configured on this server.
      </p>
    );
  }

  if (state === "blocked") {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-300">
        Notifications are blocked for this site. Re-enable them in your
        browser&apos;s site settings, then refresh this page.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {state === "subscribed"
          ? "You'll get a push on this device alongside the email."
          : "Get a phone notification when a tee time is 1 hour away (in addition to the email)."}
      </p>
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-2 text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}
      {state === "subscribed" ? (
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:hover:border-red-900/60 dark:hover:bg-red-900/30 dark:hover:text-red-300 disabled:opacity-50"
        >
          {busy ? "Disabling…" : "✓ Enabled on this device — Disable"}
        </button>
      ) : (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? "Enabling…" : "Enable on this device"}
        </button>
      )}
    </div>
  );
}
