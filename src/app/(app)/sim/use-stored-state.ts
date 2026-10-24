"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * JSON state persisted to sessionStorage (per-tab "this sim night" state:
 * skips, wheel mode) or localStorage (per-device prefs: sound). Built on
 * useSyncExternalStore so the server render uses the fallback and the
 * client hydrates without a mismatch or a setState-in-effect.
 */
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function store(kind: "session" | "local"): Storage | null {
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function useStoredState<T>(
  key: string,
  fallback: T,
  kind: "session" | "local" = "session"
): [T, (next: T) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => store(kind)?.getItem(key) ?? null,
    () => null
  );
  const value = useMemo(() => {
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
    // fallback is a literal at each call site; keying on raw is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);
  const set = useCallback(
    (next: T) => {
      try {
        store(kind)?.setItem(key, JSON.stringify(next));
      } catch {
        // Private mode / blocked storage: state just won't persist.
      }
      listeners.forEach((l) => l());
    },
    [key, kind]
  );
  return [value, set];
}
