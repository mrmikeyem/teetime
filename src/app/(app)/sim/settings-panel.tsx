"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WheelMode, WheelSettings } from "@/lib/sim-wheel";
import { SIM_THEMES, type SimThemeId } from "./themes";
import { ErrorNote, Switch, simApi } from "./ui";

export function SettingsPanel({
  settings,
  mode,
  onMode,
  adjustTallies,
  onAdjustTallies,
  theme,
  onTheme,
  skippedCount,
  onResetSession,
  flashy,
  onFlashy,
  isAdmin,
  onManualPlay,
}: {
  settings: WheelSettings;
  mode: WheelMode;
  onMode: (m: WheelMode) => void;
  adjustTallies: boolean;
  onAdjustTallies: (on: boolean) => void;
  theme: SimThemeId;
  onTheme: (t: SimThemeId) => void;
  skippedCount: number;
  onResetSession: () => void;
  flashy: boolean;
  onFlashy: (on: boolean) => void;
  isAdmin: boolean;
  onManualPlay: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [resetArmed, setResetArmed] = useState(false);
  // Optimistic overlay on the shared settings while a save is in flight.
  const [pending, setPending] = useState<Partial<WheelSettings>>({});
  const s = { ...settings, ...pending };

  async function save(patch: Partial<WheelSettings>) {
    setPending((p) => ({ ...p, ...patch }));
    setError("");
    const res = await simApi("/api/sim/settings", "PATCH", patch);
    if (!res.ok) setError(res.error);
    router.refresh();
    setPending((p) => {
      const next = { ...p };
      for (const k of Object.keys(patch) as (keyof WheelSettings)[]) delete next[k];
      return next;
    });
  }

  return (
    <section className="sim-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3"
        style={{ background: open ? "var(--sim-primary-soft)" : undefined }}
      >
        <span className="sim-heading text-lg font-bold">⚙️ Settings</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }}>▼</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-4 pb-4 pt-2 text-sm">
              <Row label="Weighted by person" hint="Each playing player gets an equal share of the wheel (this device only).">
                <Switch on={mode === "byPlayer"} onChange={(on) => onMode(on ? "byPlayer" : "equal")} label="Weighted by person" />
              </Row>
              <Row label="Tee-shot reveal" hint="The wheel whirls away and a tee shot reveals the course (this device only).">
                <Switch on={flashy} onChange={onFlashy} label="Tee-shot reveal" />
              </Row>
              <Row label="Courses per player" hint="Only the top N of each list (drag order) go on the wheel.">
                <select
                  className="sim-input w-auto"
                  value={s.courseLimit}
                  onChange={(e) => save({ courseLimit: Number(e.target.value) })}
                >
                  <option value={0}>All courses</option>
                  {[1, 2, 3, 5, 10].map((n) => (
                    <option key={n} value={n}>
                      Top {n}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Tally weighting" hint="Courses that don't get picked gain +1 tally, growing their slice.">
                <Switch on={s.tallyEnabled} onChange={(on) => save({ tallyEnabled: on })} label="Tally weighting" />
              </Row>
              <AnimatePresence initial={false}>
                {s.tallyEnabled && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 rounded-lg p-3" style={{ background: "var(--sim-surface-2)" }}>
                      <Row label="Adjust tallies" hint="Show −/+ buttons on each course (this device only).">
                        <Switch on={adjustTallies} onChange={onAdjustTallies} label="Adjust tallies" />
                      </Row>
                      <Row label="Tally mode" hint="Additive: tally = extra slices. Multiplier: weight = multiplier^tally.">
                        <select
                          className="sim-input w-auto"
                          value={s.tallyMode}
                          onChange={(e) => save({ tallyMode: e.target.value as WheelSettings["tallyMode"] })}
                        >
                          <option value="ADDITIVE">Additive</option>
                          <option value="MULTIPLIER">Multiplier</option>
                        </select>
                      </Row>
                      {s.tallyMode === "MULTIPLIER" && (
                        <Row label="Multiplier">
                          <input
                            type="number"
                            min={1.1}
                            max={3}
                            step={0.1}
                            className="sim-input w-20"
                            defaultValue={s.tallyMultiplier}
                            key={settings.tallyMultiplier}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (v !== settings.tallyMultiplier) save({ tallyMultiplier: v });
                            }}
                          />
                        </Row>
                      )}
                      <button
                        type="button"
                        className="sim-btn sim-btn-secondary w-full"
                        onClick={async () => {
                          if (!resetArmed) {
                            setResetArmed(true);
                            setTimeout(() => setResetArmed(false), 3000);
                            return;
                          }
                          setResetArmed(false);
                          const res = await simApi("/api/sim/tallies/reset", "POST");
                          if (!res.ok) setError(res.error);
                          router.refresh();
                        }}
                      >
                        {resetArmed ? "Tap again to reset every tally to 0" : "Reset all tallies"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <Row label="Theme">
                <div className="flex flex-wrap gap-1.5">
                  {SIM_THEMES.map((t) => (
                    <motion.button
                      key={t.id}
                      type="button"
                      title={t.label}
                      aria-label={t.label}
                      whileHover={{ scale: 1.12 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onTheme(t.id)}
                      className="h-7 w-7 rounded-full"
                      style={{
                        background: t.swatch,
                        border: `2px solid ${t.ring ?? "rgba(0,0,0,0.15)"}`,
                        outline: theme === t.id ? "3px solid var(--sim-primary)" : "none",
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
              </Row>
              <button type="button" className="sim-btn sim-btn-secondary w-full" onClick={onResetSession}>
                Reset session{skippedCount > 0 ? ` (clear ${skippedCount} skip${skippedCount === 1 ? "" : "s"})` : " (clear skips)"}
              </button>
              {isAdmin && (
                <button type="button" className="sim-btn sim-btn-primary w-full" onClick={onManualPlay}>
                  🎯 Manual play (admin)
                </button>
              )}
              <ErrorNote error={error} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-semibold">{label}</div>
        {hint && <div className="sim-muted text-xs">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
