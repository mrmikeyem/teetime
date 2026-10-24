"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { WheelEntry } from "@/lib/sim-wheel";
import { sfx } from "./sound";
import type { SimScene } from "./themes";

/**
 * The slot-machine reveal: after the wheel whirls away, a golfer tees off,
 * the camera follows the ball onto the green, it drops in the cup, and the
 * camera tilts up the flagstick to name the course.
 *
 * The whole scene is one pure timeline — `frame(t)` maps elapsed ms to every
 * position — driven by a single rAF loop that writes SVG attributes
 * directly (no React re-render per frame). Tap anywhere to skip to the end.
 */

// World coordinates (SVG user units). The camera frames an 800×500 view.
const GROUND = 400;
const TEE_X = 200;
const BALL_X0 = 227;
const LAND_X = 1630;
const CUP_X = 1740;
const PEAK = 300;
const FLAG_TOP = 150;
const BALL_R = 3.2;

const T = {
  swing: 350,
  top: 1150,
  impact: 1300,
  finish: 1650,
  land: 3450,
  hop2: 3900,
  roll: 4200,
  lip: 5050,
  drop: 5300,
  holed: 5550,
  pan: 5700,
  named: 7000,
  done: 8900,
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
const easeIn = (u: number) => u * u * u;

/** Ball contact point (x, ground-relative y) and visibility at time t. */
function ballAt(t: number): { x: number; y: number; opacity: number } {
  if (t < T.impact) return { x: BALL_X0, y: GROUND, opacity: 1 };
  if (t < T.land) {
    const f = seg(t, T.impact, T.land);
    return { x: lerp(BALL_X0, LAND_X, f), y: GROUND - 4 * PEAK * f * (1 - f), opacity: 1 };
  }
  if (t < T.hop2) {
    const u = seg(t, T.land, T.hop2);
    return { x: lerp(LAND_X, 1690, u), y: GROUND - 22 * Math.sin(Math.PI * u), opacity: 1 };
  }
  if (t < T.roll) {
    const u = seg(t, T.hop2, T.roll);
    return { x: lerp(1690, 1716, u), y: GROUND - 7 * Math.sin(Math.PI * u), opacity: 1 };
  }
  if (t < T.lip) {
    return { x: lerp(1716, CUP_X, easeOut(seg(t, T.roll, T.lip))), y: GROUND, opacity: 1 };
  }
  if (t < T.drop) {
    // Hangs on the lip for a heartbeat...
    const u = seg(t, T.lip, T.drop);
    return { x: CUP_X + 2.4 * Math.sin(u * 3 * Math.PI) * (1 - u), y: GROUND, opacity: 1 };
  }
  // ...and drops.
  const u = seg(t, T.drop, T.holed);
  return { x: CUP_X, y: GROUND + 9 * easeIn(u), opacity: 1 - u };
}

/** Club/arm rotation (degrees) around the shoulders. */
function swingAngle(t: number): number {
  if (t < T.swing) return 0;
  if (t < T.top) return lerp(0, 168, easeInOut(seg(t, T.swing, T.top)));
  if (t < T.impact) return lerp(168, -4, easeIn(seg(t, T.top, T.impact)));
  if (t < T.finish) return lerp(-4, -172, easeOut(seg(t, T.impact, T.finish)));
  return -172;
}

function camera(t: number, ball: { x: number; y: number }): { x: number; y: number; s: number } {
  if (t < T.impact) {
    return { x: TEE_X + 22, y: 356, s: lerp(2.0, 2.25, easeOut(seg(t, 0, T.impact))) };
  }
  if (t < T.land) {
    const f = seg(t, T.impact, T.land);
    const blend = easeInOut(Math.min(f / 0.15, 1));
    const s =
      f < 0.25
        ? lerp(2.25, 1, easeInOut(f / 0.25))
        : f > 0.7
          ? lerp(1, 2.6, easeInOut((f - 0.7) / 0.3))
          : 1;
    return {
      x: lerp(TEE_X + 22, ball.x, blend),
      y: lerp(356, (ball.y + 380) / 2, blend),
      s,
    };
  }
  if (t < T.pan) {
    return { x: ball.x, y: 392, s: lerp(2.6, 3.1, seg(t, T.land, T.pan)) };
  }
  const u = easeInOut(seg(t, T.pan, T.named));
  return { x: lerp(CUP_X, CUP_X + 32, u), y: lerp(392, FLAG_TOP + 30, u), s: lerp(3.1, 1.9, u) };
}

function flagPath(t: number): string {
  const x = CUP_X;
  const y = FLAG_TOP;
  const w = 5 * Math.sin(t / 190);
  const v = 3 * Math.sin(t / 140 + 1);
  return `M ${x} ${y} C ${x + 21} ${y - w} ${x + 42} ${y + w} ${x + 64} ${y + 2 + v} L ${x + 64} ${y + 40 + v} C ${x + 42} ${y + 38 + w} ${x + 21} ${y + 38 - w} ${x} ${y + 38} Z`;
}

function trailPath(t: number): string {
  const end = seg(t, T.impact, T.land);
  if (end <= 0) return "";
  const pts: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const f = (end * i) / 24;
    pts.push(`${lerp(BALL_X0, LAND_X, f).toFixed(1)} ${(GROUND - BALL_R - 4 * PEAK * f * (1 - f)).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")}`;
}

export function ShotReveal({
  slice,
  scene,
  soundOn,
  onDone,
}: {
  slice: WheelEntry;
  scene: SimScene;
  soundOn: boolean;
  onDone: (slice: WheelEntry) => void;
}) {
  const camRef = useRef<SVGGElement>(null);
  const farRef = useRef<SVGGElement>(null);
  const armsRef = useRef<SVGGElement>(null);
  const torsoRef = useRef<SVGGElement>(null);
  const ballRef = useRef<SVGCircleElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const flagRef = useRef<SVGPathElement>(null);
  const skipRef = useRef(false);
  const [named, setNamed] = useState(false);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const fired = new Set<string>();
    const once = (key: string, fn: () => void) => {
      if (!fired.has(key)) {
        fired.add(key);
        fn();
      }
    };

    const loop = (now: number) => {
      // Skipping jumps the clock to the reveal.
      const t = skipRef.current ? Math.max(now - start, T.named) : now - start;
      const ball = ballAt(t);
      const cam = camera(t, ball);

      camRef.current?.setAttribute(
        "transform",
        `translate(400 250) scale(${cam.s}) translate(${-cam.x} ${-cam.y})`
      );
      // Distant hills drift slower than the world (parallax) and sink as
      // the camera tilts up the flagstick.
      farRef.current?.setAttribute(
        "transform",
        `translate(${-(cam.x - TEE_X) * 0.12} ${(392 - cam.y) * 0.35})`
      );
      const a = swingAngle(t);
      armsRef.current?.setAttribute("transform", `rotate(${a} 3 -55)`);
      torsoRef.current?.setAttribute("transform", `rotate(${a * 0.05} 0 -34)`);

      const height = GROUND - ball.y;
      ballRef.current?.setAttribute("cx", String(ball.x));
      ballRef.current?.setAttribute("cy", String(ball.y - BALL_R));
      ballRef.current?.setAttribute("opacity", String(ball.opacity));
      shadowRef.current?.setAttribute("cx", String(ball.x));
      shadowRef.current?.setAttribute("rx", String(Math.max(1.2, 4.5 * (1 - height / (PEAK + 40)))));
      shadowRef.current?.setAttribute(
        "opacity",
        String(t < T.drop ? 0.32 * (1 - Math.min(height, 300) / 340) : 0)
      );
      trailRef.current?.setAttribute("d", trailPath(t));
      trailRef.current?.setAttribute("opacity", String(0.75 * (1 - seg(t, T.land, T.land + 700))));
      flagRef.current?.setAttribute("d", flagPath(now));

      if (soundOn && !skipRef.current) {
        if (t >= T.top) once("strike", sfx.strike);
        if (t >= T.land) once("land", () => sfx.thud(0.12));
        if (t >= T.hop2) once("hop", () => sfx.thud(0.06));
        if (t >= T.drop) once("cup", sfx.cup);
      }
      if (t >= T.named) {
        once("named", () => {
          setNamed(true);
          if (soundOn) sfx.chime();
          import("canvas-confetti").then(({ default: confetti }) => {
            const colors = [scene.flag, "#ffffff", scene.green];
            confetti({ particleCount: 120, spread: 90, startVelocity: 42, origin: { x: 0.5, y: 0.42 }, colors });
          });
        });
      }
      if (t >= (skipRef.current ? T.named + 900 : T.done)) once("done", () => onDone(slice));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // The scene runs once per mount (keyed by the winning course).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-30 cursor-pointer overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      transition={{ duration: 0.6 }}
      onClick={() => {
        skipRef.current = true;
      }}
      role="presentation"
    >
      <svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="sim-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={scene.skyTop} />
            <stop offset="1" stopColor={scene.skyBottom} />
          </linearGradient>
          <radialGradient id="sim-ball" cx="0.35" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#d9d9d9" />
          </radialGradient>
        </defs>
        <rect x="-200" y="-200" width="1200" height="900" fill="url(#sim-sky)" />
        <circle cx="610" cy="95" r="38" fill={scene.sun} opacity="0.85" />
        <circle cx="610" cy="95" r="60" fill={scene.sun} opacity="0.15" />
        <Clouds color="#ffffff" />

        {/* Distant hills (parallax layer, screen space). */}
        <g ref={farRef}>
          <path
            d="M -400 360 Q -250 300 -100 340 T 200 330 T 500 335 T 800 320 T 1100 340 T 1400 330 L 1400 700 L -400 700 Z"
            fill={scene.hills}
            opacity="0.55"
          />
        </g>

        {/* The world. */}
        <g ref={camRef}>
          {[420, 640, 980, 1240, 1420, 1990, 2150].map((x, i) => (
            <Tree key={x} x={x} scale={0.8 + (i % 3) * 0.25} color={scene.trees} />
          ))}
          <rect x="-1500" y={GROUND} width="5000" height="900" fill={scene.rough} />
          <path
            d={`M 240 ${GROUND} L 1950 ${GROUND} Q 1990 ${GROUND + 9} 1950 ${GROUND + 18} L 240 ${GROUND + 18} Q 200 ${GROUND + 9} 240 ${GROUND} Z`}
            fill={scene.fairway}
          />
          {/* Mowing stripes */}
          {Array.from({ length: 17 }, (_, i) => (
            <rect key={i} x={260 + i * 100} y={GROUND} width="50" height="18" fill="#ffffff" opacity="0.05" />
          ))}
          <rect x="168" y={GROUND - 1} width="78" height="7" rx="3" fill={scene.fairway} />
          {scene.bushes &&
            [1560, 1610, 1880, 1930].map((x) => (
              <g key={x}>
                <ellipse cx={x} cy={GROUND - 4} rx="16" ry="9" fill={scene.trees} />
                <ellipse cx={x} cy={GROUND - 7} rx="13" ry="6" fill={scene.bushes} opacity="0.9" />
              </g>
            ))}
          <ellipse cx={CUP_X} cy={GROUND + 4} rx="178" ry="17" fill={scene.fairway} />
          <ellipse cx={CUP_X} cy={GROUND + 3} rx="150" ry="12" fill={scene.green} />
          <ellipse cx={CUP_X} cy={GROUND + 0.6} rx="4.6" ry="1.7" fill="#0b0b0b" />
          <line x1={CUP_X} y1={GROUND} x2={CUP_X} y2={FLAG_TOP - 2} stroke="#f4f4f4" strokeWidth="1.6" />
          <circle cx={CUP_X} cy={FLAG_TOP - 3} r="1.8" fill="#f4f4f4" />
          <path ref={flagRef} fill={scene.flag} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />

          <Golfer color={scene.golfer} torsoRef={torsoRef} armsRef={armsRef} />

          <path ref={trailRef} fill="none" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="0.1 5" />
          <ellipse ref={shadowRef} cy={GROUND + 0.8} ry="1.2" fill="#000000" />
          <circle ref={ballRef} r={BALL_R} fill="url(#sim-ball)" stroke="rgba(0,0,0,0.35)" strokeWidth="0.5" />
        </g>
      </svg>

      <AnimatePresence>
        {named && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-[60%] flex justify-center px-4"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
          >
            <div
              className="rounded-2xl px-6 py-4 text-center shadow-2xl"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", color: "#fff" }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-80">Tonight&apos;s course</p>
              <p className="sim-heading mt-1 text-[clamp(1.6rem,6vw,3.2rem)] font-bold leading-tight">
                <SlotText text={slice.courseName} />
              </p>
              <p className="mt-1 text-sm opacity-80">
                Suggested by {slice.suggesters.map((s) => s.name).join(", ")}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!named && (
        <p className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-xs font-semibold text-white/80 drop-shadow">
          Tap to skip
        </p>
      )}
    </motion.div>
  );
}

const REEL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const REEL_TICK_MS = 45;

/** Slot-machine letters: each character rolls, then locks in left→right. */
function SlotText({ text }: { text: string }) {
  const chars = Array.from(text);
  const settleTick = (i: number) => 6 + Math.floor(i * 1.4);
  const lastTick = settleTick(chars.length) + 1;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((n) => {
        if (n >= lastTick) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, REEL_TICK_MS);
    return () => clearInterval(id);
  }, [lastTick]);

  return (
    <span aria-label={text}>
      {chars.map((c, i) => {
        const settled = tick >= settleTick(i) || c === " ";
        // Rolling letters keep the final letter's case so the width barely
        // changes — otherwise the line re-wraps while it spins.
        const roll = REEL[(tick * 7 + i * 11) % REEL.length];
        const shown = settled
          ? c
          : /[a-z]/.test(c)
            ? roll.toLowerCase()
            : /[A-Z]/.test(c)
              ? roll
              : c;
        return (
          <span
            key={i}
            aria-hidden
            className="inline-block transition-[filter,transform] duration-150"
            style={settled ? undefined : { filter: "blur(0.6px)", transform: "translateY(-2px)", opacity: 0.75 }}
          >
            {c === " " ? " " : shown}
          </span>
        );
      })}
    </span>
  );
}

function Golfer({
  color,
  torsoRef,
  armsRef,
}: {
  color: string;
  torsoRef: React.Ref<SVGGElement>;
  armsRef: React.Ref<SVGGElement>;
}) {
  // Feet at (0,0), facing the target (+x). Stylized silhouette.
  return (
    <g transform={`translate(${TEE_X} ${GROUND})`} stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <path d="M -9 0 L -3 -18 L -2 -34 M 9 0 L 4 -18 L 2 -34" strokeWidth="6" fill="none" />
      <g ref={torsoRef}>
        <path d="M 0 -34 L 3 -56" strokeWidth="11" />
        <circle cx="6" cy="-66" r="6.5" fill={color} stroke="none" />
        <path d="M 0 -70 Q 6 -76 12 -70 L 15 -69" strokeWidth="2.4" fill="none" />
        <g ref={armsRef}>
          <path d="M 3 -55 L 13 -29" strokeWidth="5" />
          <path d="M 13 -29 L 27 -2" strokeWidth="1.6" />
          <path d="M 25 -2 L 31 -1" strokeWidth="3" />
        </g>
      </g>
    </g>
  );
}

function Tree({ x, scale, color }: { x: number; scale: number; color: string }) {
  return (
    <g transform={`translate(${x} ${GROUND}) scale(${scale})`}>
      <rect x="-2.5" y="-26" width="5" height="26" fill={color} opacity="0.85" />
      <ellipse cx="0" cy="-42" rx="17" ry="24" fill={color} />
      <ellipse cx="-9" cy="-30" rx="12" ry="14" fill={color} />
      <ellipse cx="10" cy="-32" rx="12" ry="15" fill={color} />
    </g>
  );
}

function Clouds({ color }: { color: string }) {
  return (
    <g opacity="0.55">
      {[
        { x: 90, y: 80, s: 1 },
        { x: 360, y: 55, s: 0.7 },
        { x: 720, y: 150, s: 0.85 },
      ].map((c, i) => (
        <motion.g
          key={i}
          initial={{ x: 0 }}
          animate={{ x: 40 }}
          transition={{ duration: 9 + i * 3, ease: "linear" }}
        >
          <g transform={`translate(${c.x} ${c.y}) scale(${c.s})`} fill={color}>
            <ellipse cx="0" cy="0" rx="34" ry="12" />
            <ellipse cx="-16" cy="-6" rx="16" ry="11" />
            <ellipse cx="12" cy="-9" rx="18" ry="13" />
          </g>
        </motion.g>
      ))}
    </g>
  );
}
