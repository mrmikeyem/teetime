"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import type { SimHubData } from "@/lib/sim";

export type HubPlayer = SimHubData["players"][number];
export type HubEntry = HubPlayer["list"][number];
export type HubPlay = SimHubData["plays"][number];
export type CoursePick = {
  name: string;
  apiId: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};
export type TeePick = {
  name: string;
  rating: number | null;
  slope: number | null;
  yards: number | null;
};

/** JSON fetch for the sim API; resolves to {ok, data|error}. */
export async function simApi<T = Record<string, unknown>>(
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(path, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `Request failed (${res.status})` };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Network error — try again" };
  }
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]"
            onClick={onClose}
            tabIndex={-1}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`sim-card relative max-h-[88dvh] w-full overflow-y-auto rounded-b-none p-5 sm:rounded-b-[var(--sim-radius)] ${
              wide ? "sm:max-w-xl" : "sm:max-w-md"
            }`}
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="sim-muted absolute right-3 top-3 rounded-full px-2 py-0.5 text-lg leading-none hover:opacity-70"
            >
              ✕
            </button>
            {title && (
              <h2 className="sim-heading mb-3 pr-8 text-xl font-bold">{title}</h2>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Switch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      data-on={on}
      onClick={() => onChange(!on)}
      className="sim-switch disabled:opacity-50"
    >
      <motion.span
        className="absolute h-[1.1rem] w-[1.1rem] rounded-full bg-white shadow"
        animate={{ x: on ? 22 : 3 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

export function ErrorNote({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p className="mt-2 rounded-md px-3 py-2 text-xs font-medium text-white" style={{ background: "var(--sim-danger)" }}>
      {error}
    </p>
  );
}

const CT = "America/Chicago";

/** "January 3rd, 2026" in Central time. */
export function formatDateNice(iso: string): string {
  const d = new Date(iso);
  const day = Number(d.toLocaleDateString("en-US", { timeZone: CT, day: "numeric" }));
  const mod10 = day % 10;
  const suffix =
    mod10 === 1 && day !== 11 ? "st" : mod10 === 2 && day !== 12 ? "nd" : mod10 === 3 && day !== 13 ? "rd" : "th";
  const month = d.toLocaleDateString("en-US", { timeZone: CT, month: "long" });
  const year = d.toLocaleDateString("en-US", { timeZone: CT, year: "numeric" });
  return `${month} ${day}${suffix}, ${year}`;
}

export function formatPlayDate(iso: string, dateOnly: boolean): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    timeZone: CT,
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
  if (dateOnly) return date;
  return `${date} ${d.toLocaleTimeString("en-US", { timeZone: CT, hour: "numeric", minute: "2-digit" })}`;
}

/** CT wall-clock parts for date/time inputs ("YYYY-MM-DD", "HH:MM"). */
export function ctInputParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-CA", { timeZone: CT });
  const time = d.toLocaleTimeString("en-GB", {
    timeZone: CT,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { date, time };
}

export function teeColorClass(name: string | null | undefined): string {
  const n = (name ?? "").toLowerCase();
  if (n.includes("gold") || n.includes("yellow")) return "sim-tee-gold";
  if (n.includes("blue")) return "sim-tee-blue";
  if (n.includes("white")) return "sim-tee-white";
  if (n.includes("black")) return "sim-tee-black";
  if (n.includes("red")) return "sim-tee-red";
  if (n.includes("green")) return "sim-tee-green";
  if (n.includes("silver") || n.includes("grey") || n.includes("gray")) return "sim-tee-silver";
  if (n.includes("orange")) return "sim-tee-orange";
  return "sim-tee-default";
}

export function teeLabel(tee: TeePick): string {
  if (tee.rating != null && tee.slope != null && tee.yards != null) {
    return `${tee.name} ${tee.rating.toFixed(1)}/${tee.slope}/${tee.yards.toLocaleString()} yds`;
  }
  return tee.name;
}

/** Player chip multi-select (suggested by / players). */
export function PlayerChips({
  players,
  selected,
  onToggle,
}: {
  players: { id: string; name: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {players.map((p) => {
        const on = selected.has(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            className="rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
            style={
              on
                ? { background: "var(--sim-primary)", color: "var(--sim-on-primary)", borderColor: "var(--sim-primary)" }
                : { background: "transparent", color: "var(--sim-text)", borderColor: "var(--sim-border)" }
            }
          >
            {on ? "✓ " : ""}
            {p.name}
          </button>
        );
      })}
    </div>
  );
}
