"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Fallback poll, used only while the event stream is down.
const FALLBACK_POLL_MS = 30_000;
// Collapse bursts of events (e.g. a join firing several notifications)
// into a single refresh.
const REFRESH_DEBOUNCE_MS = 250;

export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    function refreshSoon() {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    }

    function startPoll() {
      if (pollTimer) return;
      pollTimer = setInterval(() => router.refresh(), FALLBACK_POLL_MS);
    }
    function stopPoll() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function connect() {
      if (stopped || es) return;
      es = new EventSource("/api/events");
      es.onopen = () => {
        // Connected (or reconnected): catch up on anything missed while
        // disconnected, and rely on the stream instead of the poll.
        router.refresh();
        stopPoll();
      };
      es.onmessage = refreshSoon;
      es.onerror = () => {
        // EventSource retries on its own; poll until it's back.
        startPoll();
      };
    }

    function disconnect() {
      es?.close();
      es = null;
    }

    function onResume() {
      // Coming back to the foreground: refresh immediately, then reconnect
      // (onopen would refresh too, but only once the stream is up).
      router.refresh();
      connect();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        onResume();
      } else {
        // Don't hold a stream open in the background — iOS will kill it
        // anyway, and dropping it frees the reconnect to do the catch-up.
        disconnect();
        stopPoll();
      }
    }

    function onPageShow(e: PageTransitionEvent) {
      // iOS PWAs can restore a frozen snapshot (bfcache) without a
      // visibilitychange — treat a persisted restore as a resume.
      if (e.persisted) onResume();
    }

    if (document.visibilityState === "visible") connect();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      stopped = true;
      disconnect();
      stopPoll();
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
