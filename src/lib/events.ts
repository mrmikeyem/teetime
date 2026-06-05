// Tiny in-process pub/sub bridging API mutations to SSE clients.
// The app runs as a single Node process (teetimes.service), so module-level
// state is sufficient; the globalThis guard keeps one listener set across
// dev HMR reloads, mirroring lib/prisma.ts.

export type ChangeEvent = { type: "change"; teeTimeId?: string };

type Listener = (event: ChangeEvent) => void;

const globalForEvents = globalThis as unknown as {
  teeTimeEventListeners: Set<Listener> | undefined;
};

const listeners = (globalForEvents.teeTimeEventListeners ??= new Set());

/** Subscribe to change events. Returns an unsubscribe function. */
export function subscribeToChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Notify connected SSE clients that tee time data changed. Fire-and-forget:
 * a throwing listener must never break the mutation that called us.
 */
export function broadcastChange(teeTimeId?: string) {
  for (const listener of listeners) {
    try {
      listener({ type: "change", teeTimeId });
    } catch {
      // Listener cleanup is the SSE route's job; ignore here.
    }
  }
}
