"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "ttt:installNudgeDismissed";

/**
 * iOS-only "Add to Home Screen" nudge. Shows on iOS Safari (non-standalone)
 * until the user dismisses it. Skips Android (Chrome shows its own native
 * install prompt automatically when the manifest criteria are met), iOS
 * Chrome (can't install PWAs there), and already-installed users.
 */
export function InstallNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Bail if user dismissed previously
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }

    // Already installed (standalone) → bail
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari sets this when launched from home-screen
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Only iOS Safari — Chrome on iOS has 'CriOS' in UA, real Safari doesn't
    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (!isIOS || !isSafari) return;

    setShow(true);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
            <ShareIcon />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Install Tee Time Tracker</p>
            <p className="mt-0.5 text-xs text-gray-600">
              Tap <span aria-hidden>⎙</span> Share, then{" "}
              <span className="font-semibold">Add to Home Screen</span> for the
              app experience.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 text-emerald-700"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}
