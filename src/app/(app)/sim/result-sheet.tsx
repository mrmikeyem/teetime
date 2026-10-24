"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { WheelEntry } from "@/lib/sim-wheel";
import { TeePicker } from "./course-modals";
import { ErrorNote, Modal, formatDateNice, type TeePick } from "./ui";

export type Selection = {
  slice: WheelEntry;
  /** Picked via Manual Play (admin) rather than spun. */
  manual: boolean;
};

export type CourseMeta = { apiId: number | null; location: string };

/** The "🎯 Selected Course" card that springs up after a spin. */
export function ResultSheet({
  selection,
  meta,
  lastPlayed,
  showTally,
  busy,
  error,
  onPlay,
  onSkip,
  onCancel,
  onInfo,
}: {
  selection: Selection | null;
  meta: CourseMeta | null;
  lastPlayed: string | null;
  showTally: boolean;
  busy: boolean;
  error: string;
  onPlay: () => void;
  onSkip: () => void;
  onCancel: () => void;
  onInfo: (apiId: number) => void;
}) {
  return (
    <AnimatePresence>
      {selection && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[3px]"
            onClick={onCancel}
            tabIndex={-1}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="sim-card relative w-full overflow-hidden rounded-b-none text-center sm:max-w-md sm:rounded-b-[var(--sim-radius)]"
            initial={{ y: 120, scale: 0.9, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 80, scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
          >
            <div
              className="px-5 pb-4 pt-6"
              style={{ background: "linear-gradient(180deg, var(--sim-primary-soft), transparent)" }}
            >
              <button
                type="button"
                onClick={onCancel}
                aria-label="Close"
                className="sim-muted absolute right-3 top-3 rounded-full px-2 text-lg hover:opacity-70"
              >
                ✕
              </button>
              <motion.p
                className="sim-muted text-xs font-semibold uppercase tracking-[0.2em]"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {selection.manual ? "🎯 Manual pick" : "🎯 The wheel has spoken"}
              </motion.p>
              <motion.h2
                className="sim-heading mt-2 text-3xl font-bold leading-tight"
                style={{ color: "var(--sim-primary)" }}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.18, type: "spring", stiffness: 260, damping: 14 }}
              >
                {selection.slice.courseName}
                {meta?.apiId ? (
                  <button
                    type="button"
                    title="Course info"
                    className="ml-1 align-middle text-base"
                    onClick={() => meta.apiId && onInfo(meta.apiId)}
                  >
                    ℹ️
                  </button>
                ) : null}
              </motion.h2>
              <motion.div
                className="mt-3 space-y-1 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.32 }}
              >
                {meta?.location && <p>📍 {meta.location}</p>}
                <p>
                  Suggested by{" "}
                  <strong>{selection.slice.suggesters.map((s) => s.name).join(", ")}</strong>
                </p>
                <p className="sim-muted">
                  {lastPlayed ? `Last played ${formatDateNice(lastPlayed)}` : "Never played on the sim"}
                  {showTally && selection.slice.totalTally > 0
                    ? ` · tally ${selection.slice.totalTally}`
                    : ""}
                </p>
              </motion.div>
            </div>
            <motion.div
              className="grid grid-cols-3 gap-2 px-5 pb-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42 }}
            >
              <button type="button" className="sim-btn sim-btn-primary py-3" disabled={busy} onClick={onPlay}>
                ✓ Play
              </button>
              <button
                type="button"
                className="sim-btn py-3"
                style={{ background: "#f0a030", color: "#fff" }}
                disabled={busy || selection.manual}
                onClick={onSkip}
                title={selection.manual ? "Manual picks can't be skipped" : undefined}
              >
                ⏭ Skip
              </button>
              <button type="button" className="sim-btn sim-btn-ghost py-3" disabled={busy} onClick={onCancel}>
                ✕ Cancel
              </button>
            </motion.div>
            <div className="px-5 pb-4">
              <ErrorNote error={error} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Pick the tees, then log the round. */
export function TeeModal({
  open,
  courseName,
  apiId,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  courseName: string;
  apiId: number | null;
  busy: boolean;
  error: string;
  onConfirm: (tee: TeePick | null) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="⛳ Select tees played">
      {open && (
        <TeeBody courseName={courseName} apiId={apiId} busy={busy} error={error} onConfirm={onConfirm} onClose={onClose} />
      )}
    </Modal>
  );
}

function TeeBody({
  courseName,
  apiId,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  courseName: string;
  apiId: number | null;
  busy: boolean;
  error: string;
  onConfirm: (tee: TeePick | null) => void;
  onClose: () => void;
}) {
  const [tee, setTee] = useState<TeePick | null>(null);
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Which tees did you play at <strong>{courseName}</strong>?
      </p>
      <TeePicker apiId={apiId} initial={null} onChange={setTee} />
      <ErrorNote error={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="sim-btn sim-btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="sim-btn sim-btn-primary" disabled={busy} onClick={() => onConfirm(tee)}>
          {busy ? "Logging…" : "✓ Confirm & log play"}
        </button>
      </div>
    </div>
  );
}

/** Admin: pick a course straight off the wheel (replaces the old PIN flow). */
export function ManualPlayModal({
  open,
  slices,
  showTally,
  onPick,
  onClose,
}: {
  open: boolean;
  slices: WheelEntry[];
  showTally: boolean;
  onPick: (slice: WheelEntry) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="🎯 Manual course selection" wide>
      <p className="sim-muted mb-3 text-sm">Pick a course to play (same as a wheel result).</p>
      {slices.length === 0 ? (
        <p className="sim-muted py-6 text-center text-sm">No courses available. Check players and add courses first.</p>
      ) : (
        <div className="max-h-[60dvh] space-y-1.5 overflow-y-auto">
          {slices.map((s, i) => (
            <motion.button
              key={s.courseId}
              type="button"
              onClick={() => onPick(s)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left hover:brightness-95"
              style={{ borderColor: "var(--sim-border)", background: "var(--sim-item)" }}
            >
              <span className="min-w-0">
                <span className="block font-semibold">{s.courseName}</span>
                <span className="sim-muted block text-xs">
                  Suggested by: {s.suggesters.map((x) => x.name).join(", ")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs">
                {showTally && s.totalTally > 0 && <TallyBadge value={s.totalTally} />}
                <span className="sim-muted">{(s.probability * 100).toFixed(1)}%</span>
              </span>
            </motion.button>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function TallyBadge({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 1.5 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 15 }}
      title="Tally weight"
      className="inline-flex min-w-[1.6rem] justify-center rounded-full px-1.5 py-0.5 text-xs font-bold"
      style={{ background: "var(--sim-primary-soft)", color: "var(--sim-text)" }}
    >
      {value}
    </motion.span>
  );
}
