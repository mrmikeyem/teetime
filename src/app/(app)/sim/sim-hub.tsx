"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimHubData } from "@/lib/sim";
import { buildWheel, eligibleCount, pickSlice, type WheelMode } from "@/lib/sim-wheel";
import { CourseInfoModal } from "./course-modals";
import { PlayLog } from "./play-log";
import { PlayersPanel } from "./players-panel";
import { ManualPlayModal, ResultSheet, TeeModal, type CourseMeta, type Selection } from "./result-sheet";
import { SettingsPanel } from "./settings-panel";
import { simTheme, type SimThemeId } from "./themes";
import { simApi, type TeePick } from "./ui";
import { useStoredState } from "./use-stored-state";
import { Wheel, type WheelHandle } from "./wheel";

export function SimHub({
  data,
  isAdmin,
  initialTheme,
  fontClassName,
}: {
  data: SimHubData;
  isAdmin: boolean;
  initialTheme: SimThemeId;
  fontClassName: string;
}) {
  const router = useRouter();
  const wheelRef = useRef<WheelHandle>(null);

  // Session ("tonight") state, per tab — same as the old app, but it now
  // survives a refresh.
  const [skippedIds, setSkippedIds] = useStoredState<string[]>("sim:skipped", []);
  const [mode, setMode] = useStoredState<WheelMode>("sim:mode", "equal");
  const [adjustTallies, setAdjustTallies] = useStoredState("sim:adjust-tallies", false);
  const [soundOn, setSoundOn] = useStoredState("sim:sound", true, "local");
  const [theme, setTheme] = useState<SimThemeId>(initialTheme);

  // While a spin + its result card are up, hold the data steady: a live
  // refresh (SSE) mid-spin must not redraw the slices under the pointer.
  const [frozen, setFrozen] = useState<SimHubData | null>(null);
  const view = frozen ?? data;

  const [spinning, setSpinning] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [teeOpen, setTeeOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [infoApiId, setInfoApiId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const skipped = useMemo(() => new Set(skippedIds), [skippedIds]);
  const slices = useMemo(
    () => buildWheel(view.players, view.settings, skipped, mode),
    [view.players, view.settings, skipped, mode]
  );
  const count = eligibleCount(view.players, view.settings, skipped);
  const colors = simTheme(theme).wheel;

  const courseMeta = useMemo(() => {
    const m = new Map<string, CourseMeta>();
    for (const p of view.players) {
      for (const e of p.list) m.set(e.courseId, { apiId: e.apiId, location: e.location });
    }
    return m;
  }, [view.players]);

  const spin = useCallback(async () => {
    if (spinning || slices.length === 0 || !wheelRef.current) return;
    setFrozen(data);
    setSpinning(true);
    setWinnerId(null);
    setError("");
    const idx = pickSlice(slices);
    await wheelRef.current.spin(idx);
    setSpinning(false);
    setWinnerId(slices[idx].courseId);
    // Let the win land (confetti, slice pop) before the card springs up.
    setTimeout(() => setSelection({ slice: slices[idx], manual: false }), 550);
  }, [spinning, slices, data]);

  // Space bar spins (when nothing else has focus).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || selection || teeOpen || manualOpen) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(tag)) return;
      e.preventDefault();
      spin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spin, selection, teeOpen, manualOpen]);

  function closeAll() {
    setSelection(null);
    setTeeOpen(false);
    setWinnerId(null);
    setFrozen(null);
    setError("");
  }

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  }

  async function skip() {
    if (!selection) return;
    setBusy(true);
    const res = await simApi("/api/sim/spin", "POST", {
      outcome: "skip",
      courseId: selection.slice.courseId,
      skippedCourseIds: skippedIds,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSkippedIds([...skippedIds, selection.slice.courseId]);
    closeAll();
    router.refresh();
  }

  async function logPlay(tee: TeePick | null) {
    if (!selection) return;
    setBusy(true);
    const res = await simApi("/api/sim/spin", "POST", {
      outcome: "play",
      courseId: selection.slice.courseId,
      skippedCourseIds: skippedIds,
      tee,
      manual: selection.manual,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    const name = selection.slice.courseName;
    setSkippedIds([...skippedIds, selection.slice.courseId]);
    closeAll();
    router.refresh();
    flash(`⛳ Logged ${name} — enjoy the round!`);
  }

  const activePlayers = view.players.map((p) => ({ id: p.id, name: p.name }));
  const selectedMeta = selection ? courseMeta.get(selection.slice.courseId) ?? null : null;

  return (
    <div data-sim-theme={theme} className={`sim-root ${fontClassName}`}>
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-5">
        <header className="mb-5 flex items-center justify-between gap-3">
          <Link href="/tee-times" className="sim-btn sim-btn-ghost text-xs">
            ← Tee times
          </Link>
          <motion.h1
            className="sim-heading text-center text-2xl font-bold sm:text-3xl"
            style={{ color: "var(--sim-title)", textShadow: "0 2px 10px rgba(0,0,0,0.2)" }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            ⛳ Golf Course Wheel
          </motion.h1>
          <button
            type="button"
            className="sim-btn sim-btn-ghost text-xs"
            onClick={() => setSoundOn(!soundOn)}
            title={soundOn ? "Mute spin sounds" : "Unmute spin sounds"}
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-5 lg:self-start">
            <section className="sim-card p-4 sm:p-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="sim-heading text-lg font-bold">Spin the Wheel</h2>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  {mode === "byPlayer" && (
                    <span className="rounded-full px-2 py-0.5" style={{ background: "var(--sim-secondary)", color: "var(--sim-secondary-text)" }}>
                      by person
                    </span>
                  )}
                  {skipped.size > 0 && (
                    <span className="rounded-full px-2 py-0.5" style={{ background: "var(--sim-surface-2)" }}>
                      {skipped.size} skipped
                    </span>
                  )}
                  <motion.span
                    key={count}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    className="rounded-full px-2 py-0.5"
                    style={{ background: "var(--sim-primary)", color: "var(--sim-on-primary)" }}
                  >
                    {count} course{count === 1 ? "" : "s"}
                  </motion.span>
                </div>
              </div>

              <div className="py-4">
                <Wheel slices={slices} colors={colors} winnerId={winnerId} soundOn={soundOn} handleRef={wheelRef} />
              </div>

              <div className="flex justify-center">
                <motion.button
                  type="button"
                  onClick={spin}
                  disabled={spinning || slices.length === 0}
                  whileHover={!spinning ? { scale: 1.05 } : undefined}
                  whileTap={!spinning ? { scale: 0.92 } : undefined}
                  animate={spinning ? { scale: [1, 0.96, 1] } : { scale: 1 }}
                  transition={spinning ? { repeat: Infinity, duration: 0.9 } : undefined}
                  className="sim-spin-btn px-12 py-3.5 text-xl font-bold tracking-wide disabled:opacity-60"
                >
                  {spinning ? "Spinning…" : "SPIN!"}
                </motion.button>
              </div>
              <p className="sim-muted mt-2 text-center text-xs">
                {slices.length === 0 ? "Check who's playing and add courses" : "Tap spin — or press the space bar"}
              </p>
            </section>
          </div>

          <div className="space-y-5">
            <SettingsPanel
              settings={view.settings}
              mode={mode}
              onMode={setMode}
              adjustTallies={adjustTallies}
              onAdjustTallies={setAdjustTallies}
              theme={theme}
              onTheme={(t) => {
                setTheme(t);
                simApi("/api/sim/theme", "PUT", { theme: t });
              }}
              skippedCount={skipped.size}
              onResetSession={() => setSkippedIds([])}
              isAdmin={isAdmin}
              onManualPlay={() => setManualOpen(true)}
            />
            <PlayersPanel
              players={view.players}
              settings={view.settings}
              skipped={skipped}
              adjustTallies={adjustTallies}
              memberCandidates={data.memberCandidates}
              onInfo={setInfoApiId}
            />
            <PlayLog plays={view.plays} players={activePlayers} onInfo={setInfoApiId} />
          </div>
        </div>
      </div>

      <ResultSheet
        selection={teeOpen ? null : selection}
        meta={selectedMeta}
        lastPlayed={selection ? view.lastPlayed[selection.slice.courseId] ?? null : null}
        showTally={view.settings.tallyEnabled}
        busy={busy}
        error={error}
        onPlay={() => setTeeOpen(true)}
        onSkip={skip}
        onCancel={closeAll}
        onInfo={setInfoApiId}
      />
      <TeeModal
        open={teeOpen && selection !== null}
        courseName={selection?.slice.courseName ?? ""}
        apiId={selectedMeta?.apiId ?? null}
        busy={busy}
        error={error}
        onConfirm={logPlay}
        onClose={closeAll}
      />
      <ManualPlayModal
        open={manualOpen}
        slices={slices}
        showTally={view.settings.tallyEnabled}
        onClose={() => setManualOpen(false)}
        onPick={(slice) => {
          setManualOpen(false);
          setFrozen(data);
          setSelection({ slice, manual: true });
          setTeeOpen(true);
        }}
      />
      <CourseInfoModal apiId={infoApiId} onClose={() => setInfoApiId(null)} />

      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
          >
            <div className="sim-card px-5 py-3 text-sm font-semibold">{toast}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
