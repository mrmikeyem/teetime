"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  useVelocity,
} from "motion/react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { landingRotation, type WheelEntry } from "@/lib/sim-wheel";
import { RisoBallArt } from "./riso-ball";
import { sfx } from "./sound";

export type WheelHandle = {
  /** Spin to the given slice index; resolves once the wheel has settled. */
  spin: (winnerIndex: number) => Promise<void>;
  /**
   * Flashy-reveal spin: whirl up to speed (the parent fades the wheel out
   * mid-spin, winner unknown), then quietly park on the winner so the wheel
   * shows it once the reveal is over.
   */
  spinAway: (winnerIndex: number) => Promise<void>;
  /** On-screen box of the hub golf ball — where the reveal picks it up. */
  hubRect: () => DOMRect | null;
};

type DisplaySlice = { id: string; name: string; sweep: number; color: string };

const R = 200; // SVG radius (viewBox units)
const LABEL_R = R - 16;
const HUB_R = 30;
const MORPH_MS = 0.5;

function polar(angleDeg: number, r: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  // Rounded: server and browser trig can differ in the last digit, which
  // is a hydration mismatch on the SVG attributes.
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return [round(Math.sin(a) * r), round(-Math.cos(a) * r)];
}

function slicePath(start: number, end: number): string {
  if (end - start >= 359.999) {
    return `M 0 ${-R} A ${R} ${R} 0 1 1 0 ${R} A ${R} ${R} 0 1 1 0 ${-R} Z`;
  }
  const [x1, y1] = polar(start, R);
  const [x2, y2] = polar(end, R);
  const large = end - start > 180 ? 1 : 0;
  return `M 0 0 L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
}

function toDisplay(slices: WheelEntry[], colors: string[]): DisplaySlice[] {
  return slices.map((s, i) => ({
    id: s.courseId,
    name: s.courseName,
    sweep: s.probability * 360,
    color: colors[i % colors.length],
  }));
}

/** Darken a #rrggbb color — label outline for readability on any slice. */
function darken(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = (shift: number) => Math.max(0, ((n >> shift) & 0xff) - Math.round(255 * amount));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

/** Confetti burst in the theme's slice colors, from the top of the wheel. */
function celebrate(el: HTMLElement, colors: string[]) {
  const rect = el.getBoundingClientRect();
  import("canvas-confetti").then(({ default: confetti }) => {
    const origin = {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height * 0.25) / window.innerHeight,
    };
    const palette = colors.slice(0, 6);
    confetti({ particleCount: 90, spread: 75, startVelocity: 38, origin, colors: palette, scalar: 0.9 });
    setTimeout(
      () => confetti({ particleCount: 50, spread: 110, startVelocity: 25, origin, colors: palette, scalar: 0.7 }),
      180
    );
  });
}

export function Wheel({
  slices,
  colors,
  winnerId,
  soundOn,
  faded = false,
  handleRef,
}: {
  slices: WheelEntry[];
  colors: string[];
  /** Highlighted slice after a spin (others dim). */
  winnerId: string | null;
  soundOn: boolean;
  /** Fade the wheel out (the tee-shot reveal has taken over the hub ball). */
  faded?: boolean;
  handleRef: React.Ref<WheelHandle>;
}) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState<DisplaySlice[]>(() => toDisplay(slices, colors));
  const displayRef = useRef(display);
  const soundRef = useRef(soundOn);
  const containerRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);

  const rotation = useMotionValue(0);
  const velocity = useVelocity(rotation);
  const blur = useTransform(velocity, (v) => `blur(${Math.min(Math.abs(v) / 1400, 1.6)}px)`);
  const pointerKick = useMotionValue(0);

  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  // Morph slices to their new sizes instead of snapping (players checked,
  // tallies bumped, a course skipped...). New slices grow from zero,
  // removed ones shrink away in place.
  useEffect(() => {
    const target = toDisplay(slices, colors);
    const from = displayRef.current;
    const fromById = new Map(from.map((s) => [s.id, s]));
    const targetIds = new Set(target.map((s) => s.id));

    const merged: { slice: DisplaySlice; from: number; to: number }[] = target.map((s) => ({
      slice: s,
      from: fromById.get(s.id)?.sweep ?? 0,
      to: s.sweep,
    }));
    from.forEach((s, i) => {
      if (!targetIds.has(s.id)) {
        merged.splice(Math.min(i, merged.length), 0, { slice: s, from: s.sweep, to: 0 });
      }
    });

    const unchanged =
      from.length === target.length &&
      target.every((s, i) => from[i].id === s.id && Math.abs(from[i].sweep - s.sweep) < 0.01 && from[i].color === s.color);
    if (unchanged) return;

    const frame = (t: number) => {
      const raw = merged.map((m) => m.from + (m.to - m.from) * t);
      const total = raw.reduce((a, b) => a + b, 0) || 1;
      const next = merged
        .map((m, i) => ({ ...m.slice, sweep: (raw[i] / total) * (target.length ? 360 : 0) }))
        .filter((s) => s.sweep > 0.0001);
      displayRef.current = next;
      setDisplay(next);
    };

    if (reduceMotion || from.length === 0) {
      frame(1);
      return;
    }
    const controls = animate(0, 1, {
      duration: MORPH_MS,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: frame,
    });
    return () => controls.stop();
  }, [slices, colors, reduceMotion]);

  // Pointer ticker: flick the pointer (and click) each time a slice
  // boundary passes under it.
  useEffect(() => {
    let lastIndex = -1;
    let lastSound = 0;
    return rotation.on("change", (v) => {
      const arcs = displayRef.current;
      if (arcs.length < 2) return;
      const under = ((-v % 360) + 360) % 360;
      let at = 0;
      let idx = 0;
      for (let i = 0; i < arcs.length; i++) {
        at += arcs[i].sweep;
        if (under < at) {
          idx = i;
          break;
        }
      }
      if (idx === lastIndex) return;
      const first = lastIndex === -1;
      lastIndex = idx;
      if (first) return;
      pointerKick.set(-24);
      animate(pointerKick, 0, { type: "spring", stiffness: 700, damping: 18 });
      const now = performance.now();
      if (soundRef.current && now - lastSound > 45) {
        lastSound = now;
        sfx.tick();
        // Android haptic tick (iOS Safari has no vibrate API).
        navigator.vibrate?.(4);
      }
    });
  }, [rotation, pointerKick]);

  useImperativeHandle(
    handleRef,
    () => ({
      hubRect() {
        return hubRef.current?.getBoundingClientRect() ?? null;
      },
      async spinAway(winnerIndex: number) {
        const arcs = displayRef.current;
        let start = 0;
        for (let i = 0; i < winnerIndex; i++) start += arcs[i].sweep;
        const arc = { start, end: start + arcs[winnerIndex].sweep };
        await animate(rotation, rotation.get() - 14, { duration: 0.32, ease: [0.45, 0, 0.55, 1] });
        // Accelerate hard — it's still flying when the scene covers it.
        await animate(rotation, rotation.get() + 2200, { duration: 1.6, ease: [0.55, 0, 1, 0.45] });
        rotation.set(landingRotation(arc, rotation.get(), 0));
      },
      async spin(winnerIndex: number) {
        const arcs = displayRef.current;
        let start = 0;
        for (let i = 0; i < winnerIndex; i++) start += arcs[i].sweep;
        const arc = { start, end: start + arcs[winnerIndex].sweep };

        if (reduceMotion) {
          rotation.set(landingRotation(arc, rotation.get(), 1));
          return;
        }
        // Wind-up: a short pull back before the launch.
        await animate(rotation, rotation.get() - 14, {
          duration: 0.32,
          ease: [0.45, 0, 0.55, 1],
        });
        const target = landingRotation(arc, rotation.get(), 6);
        const sweep = arc.end - arc.start;
        const overshoot = Math.min(1.8, Math.min(sweep * 0.2, 4) * 0.7);
        // Launch fast, then a long, suspenseful deceleration.
        await animate(rotation, target + overshoot, {
          duration: 5.6,
          ease: [0.12, 0.72, 0.16, 1],
        });
        // ...and settle back onto the winner.
        await animate(rotation, target, { type: "spring", stiffness: 140, damping: 12 });
        if (containerRef.current) celebrate(containerRef.current, colors);
      },
    }),
    [reduceMotion, rotation, colors]
  );

  const arcs = display.reduce<(DisplaySlice & { start: number; end: number })[]>((acc, s) => {
    const start = acc.length ? acc[acc.length - 1].end : 0;
    acc.push({ ...s, start, end: start + s.sweep });
    return acc;
  }, []);

  return (
    <motion.div
      ref={containerRef}
      className="relative mx-auto aspect-square w-full max-w-[min(440px,80vw)]"
      animate={{ opacity: faded ? 0 : 1 }}
      transition={{ duration: faded ? 0.35 : 0.5 }}
    >
      {/* Pointer */}
      <motion.div
        className="absolute left-1/2 top-[-10px] z-10 -ml-[15px] origin-top drop-shadow-md"
        style={{ rotate: pointerKick }}
        aria-hidden
      >
        <svg width="30" height="38" viewBox="0 0 30 38">
          <path d="M15 37 L2 6 Q15 -2 28 6 Z" fill="var(--sim-pointer)" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
          <circle cx="15" cy="10" r="3.2" fill="rgba(0,0,0,0.25)" />
        </svg>
      </motion.div>

      <motion.div className="h-full w-full" style={{ rotate: rotation, filter: blur }}>
        <svg
          viewBox={`${-R - 8} ${-R - 8} ${2 * R + 16} ${2 * R + 16}`}
          className="h-full w-full"
          role="img"
          aria-label={
            arcs.length ? `Wheel with ${arcs.length} courses` : "Empty wheel"
          }
        >
          <circle r={R + 4} fill="var(--sim-rim)" opacity="0.9" />
          {arcs.length === 0 ? (
            <g>
              <circle r={R} fill="var(--sim-surface-2)" />
              <text textAnchor="middle" y={-8} fontSize="15" fill="var(--sim-muted)">
                No courses available
              </text>
              <text textAnchor="middle" y={14} fontSize="12" fill="var(--sim-muted)">
                Check players &amp; add courses
              </text>
            </g>
          ) : (
            arcs.map((s) => {
              const mid = s.start + s.sweep / 2;
              const dim = winnerId !== null && s.id !== winnerId;
              const won = winnerId !== null && s.id === winnerId;
              const [dx, dy] = polar(mid, won ? 10 : 0);
              // Font scales with the slice's arc; length is capped by the
              // radial room between the hub and the rim.
              const arcLen = (s.sweep * Math.PI * (R - 60)) / 180;
              const fontSize = Math.max(7.5, Math.min(15, arcLen * 0.55));
              const maxChars = Math.floor((LABEL_R - HUB_R - 10) / (fontSize * 0.5));
              const label =
                s.name.length > maxChars ? `${s.name.slice(0, Math.max(maxChars - 1, 1))}…` : s.name;
              return (
                <motion.g
                  key={s.id}
                  animate={{ x: dx, y: dy, opacity: dim ? 0.32 : 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                >
                  <path
                    d={slicePath(s.start, s.end)}
                    fill={s.color}
                    stroke="var(--sim-rim)"
                    strokeWidth={arcs.length > 1 ? 1.5 : 0}
                  />
                  {s.sweep >= 2.2 && (
                    <text
                      transform={`rotate(${mid - 90})`}
                      x={LABEL_R}
                      textAnchor="end"
                      dominantBaseline="central"
                      fontSize={fontSize}
                      fontWeight={700}
                      fill="#fff"
                      stroke={darken(s.color.startsWith("#") ? s.color : "#000000", 0.38)}
                      strokeWidth={fontSize / 4.5}
                      paintOrder="stroke"
                      strokeLinejoin="round"
                      style={{ fontFamily: "var(--sim-font-body)" }}
                    >
                      {label}
                    </text>
                  )}
                </motion.g>
              );
            })
          )}
          {/* Boundary pegs on the rim — what the pointer "clicks" against. */}
          {arcs.length > 1 &&
            arcs.map((s) => {
              const [x, y] = polar(s.start, R + 1);
              return <circle key={`peg-${s.id}`} cx={x} cy={y} r={2.6} fill="var(--sim-pointer)" stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" />;
            })}
          <circle r={HUB_R + 5} fill="var(--sim-hub)" stroke="rgba(0,0,0,0.45)" strokeWidth="2" />
        </svg>
      </motion.div>
      {/* The hub golf ball sits still on the axle while the wheel turns —
          the tee-shot reveal picks this exact ball up. */}
      <div
        ref={hubRef}
        className="pointer-events-none absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2"
        style={{ width: `${((2 * HUB_R) / (2 * R + 16)) * 100}%` }}
      >
        <svg viewBox="-50 -50 100 100" className="h-full w-full overflow-visible">
          <RisoBallArt outline={2.5} />
        </svg>
      </div>
    </motion.div>
  );
}
