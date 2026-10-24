"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { WheelEntry } from "@/lib/sim-wheel";
import { RISO_INK, RisoBallArt } from "./riso-ball";
import { sfx } from "./sound";
import type { SimScene } from "./themes";

/**
 * The tee-shot reveal, in a riso-print cartoon style (flat inks, bold ink
 * outlines, grain), told from the ball's point of view:
 *
 *   hub → tee   the wheel fades; its hub golf ball drifts down onto a tee
 *   smash       a clubhead whips in — starburst, white flash, shake
 *   launch      the ball shrinks away into a speckled sky
 *   chase       top-down ball-cam over striped, winding fairway bands
 *   green       lands, hops, rolls, hangs on the lip... drops
 *   pin         whip-tilt up the flagstick; the course name reels in
 *
 * One pure timeline: every position is a function of elapsed ms, and a
 * single rAF loop writes SVG attributes directly (no React render per
 * frame). Tap anywhere to skip to the name.
 */

const CREAM = "#f7f0d6";
const W = 600; // viewBox is W×W, sliced to fill any screen; action stays central
const C = W / 2;

const T = {
  settle: 620,
  club: 1050,
  impact: 1350,
  sky: 1600,
  map: 2300,
  land: 4500,
  hop: 4700,
  roll: 4850,
  lip: 5650,
  drop: 5850,
  holed: 6050,
  whip: 6100,
  pin: 6400,
  named: 6950,
  done: 8800,
};

// Tee close-up: the ball sits on the tee here (screen coords).
const TEE_BALL = { x: C, y: 352, r: 68 };
// Top-down course (world coords): tee at the bottom, green at the top.
const LAND = { x: 300, y: 352 };
const CUP = { x: 332, y: 262 };
const MAP_START_Y = 3150;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
const easeIn = (u: number) => u * u * u;
const backOut = (u: number) => 1 + 2.4 * Math.pow(u - 1, 3) + 1.4 * Math.pow(u - 1, 2);
/** Deterministic 0..1 hash — stable "randomness" per frame step. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type Pt = { x: number; y: number };
type Origin = { x: number; y: number; r: number } | null;

/** Top-down map camera at time t (world coords + scale). */
function mapCamera(t: number, ball: Pt) {
  if (t < T.land) {
    const f = seg(t, T.map, T.land);
    return {
      x: LAND.x + 95 * Math.sin(f * 2.3 * Math.PI) * (1 - f),
      y: lerp(MAP_START_Y, LAND.y, easeInOut(f)),
      s: 0.5 + 2.3 * Math.pow(f, 3),
    };
  }
  // Ease toward the cup so it stays framed while the ball rolls.
  const u = seg(t, T.land, T.lip);
  return {
    x: lerp(ball.x, CUP.x, 0.45),
    y: lerp(ball.y, CUP.y, 0.45),
    s: lerp(2.8, 3.7, easeOut(u)),
  };
}

/** Ball on the green (world coords) + hop height + roll angle. */
function greenBall(t: number): { x: number; y: number; h: number; spin: number; k: number; o: number } {
  if (t < T.hop) {
    const u = seg(t, T.land, T.hop);
    return { x: lerp(LAND.x, 310, u), y: lerp(LAND.y, 322, u), h: 9 * Math.sin(Math.PI * u), spin: u * 90, k: 1, o: 1 };
  }
  if (t < T.roll) {
    const u = seg(t, T.hop, T.roll);
    return { x: lerp(310, 316, u), y: lerp(322, 310, u), h: 3 * Math.sin(Math.PI * u), spin: 90 + u * 30, k: 1, o: 1 };
  }
  if (t < T.lip) {
    const u = easeOut(seg(t, T.roll, T.lip));
    return { x: lerp(316, CUP.x, u), y: lerp(310, CUP.y + 16, u), h: 0, spin: 120 + u * 260, k: 1, o: 1 };
  }
  if (t < T.drop) {
    const u = seg(t, T.lip, T.drop);
    // Hangs on the front lip for a heartbeat...
    return { x: CUP.x + 3 * Math.sin(u * 3 * Math.PI) * (1 - u), y: CUP.y + 16, h: 0, spin: 380, k: 1, o: 1 };
  }
  const u = seg(t, T.drop, T.holed);
  return { x: CUP.x, y: CUP.y + 4 * easeIn(u), h: 0, spin: 380, k: 1 - 0.4 * easeIn(u), o: 1 - easeIn(u) };
}

/** Where the ball is drawn on screen (it lives in screen space). */
function ballScreen(
  t: number,
  origin: Origin
): { x: number; y: number; r: number; rot: number; sx: number; sy: number; o: number } {
  // hub → tee: from the wheel hub's spot down onto the tee.
  if (t < T.settle) {
    const from = origin ?? { x: C, y: 200, r: 30 };
    const u = easeInOut(seg(t, 0, T.settle));
    const arc = Math.sin(u * Math.PI) * -40;
    return {
      x: lerp(from.x, TEE_BALL.x, u),
      y: lerp(from.y, TEE_BALL.y, u) + arc,
      r: lerp(from.r, TEE_BALL.r, u),
      rot: 0,
      sx: 1,
      sy: 1,
      o: 1,
    };
  }
  if (t < T.impact) {
    const settle = seg(t, T.settle, T.settle + 220);
    const squash = Math.sin(settle * Math.PI) * 0.08 * (1 - settle);
    const idle = Math.sin(t / 160) * 0.6;
    return { x: TEE_BALL.x, y: TEE_BALL.y + idle, r: TEE_BALL.r, rot: 0, sx: 1 + squash, sy: 1 - squash, o: 1 };
  }
  if (t < T.sky) {
    // Smashed toward the camera and up out of frame.
    const u = seg(t, T.impact, T.sky);
    const squash = u < 0.25 ? Math.sin((u / 0.25) * Math.PI) * 0.3 : 0;
    return {
      x: lerp(TEE_BALL.x, C + 40, easeIn(u)),
      y: lerp(TEE_BALL.y, -260, easeIn(u)),
      r: lerp(TEE_BALL.r, 190, easeIn(u)),
      rot: u * 200,
      sx: 1 - squash * 0.6,
      sy: 1 + squash,
      o: 1,
    };
  }
  if (t < T.map) {
    // Launch: shrinking away into the sky.
    const u = seg(t, T.sky, T.map);
    return { x: C + 14 * Math.sin(u * 3), y: lerp(560, 150, easeOut(u)), r: lerp(30, 5, easeOut(u)), rot: u * 540, sx: 1, sy: 1, o: 1 };
  }
  if (t < T.land) {
    // Ball-cam: centered, big, spinning lazily as the world rushes past.
    const f = seg(t, T.map, T.land);
    return { x: C + 6 * Math.sin(t / 300), y: C, r: 46 + 3 * Math.sin(f * Math.PI), rot: 540 + f * 300, sx: 1, sy: 1, o: 1 };
  }
  const b = greenBall(t);
  const cam = mapCamera(t, b);
  const r = (46 / 2.8) * cam.s * (1 + b.h * 0.045) * b.k;
  const impactSquash = seg(t, T.land, T.land + 120);
  const sq = Math.sin(impactSquash * Math.PI) * 0.14;
  return {
    x: C + (b.x - cam.x) * cam.s,
    y: C + (b.y - cam.y) * cam.s - b.h * cam.s * 0.6,
    r,
    rot: 840 + b.spin,
    sx: 1 + sq,
    sy: 1 - sq,
    o: b.o,
  };
}

function flagPath(now: number): string {
  const x = 244;
  const y = 152;
  const w = 7 * Math.sin(now / 210);
  const v = 5 * Math.sin(now / 150 + 1);
  return `M ${x} ${y} C ${x + 55} ${y - w} ${x + 115} ${y + w} ${x + 172} ${y + 4 + v} L ${x + 172} ${y + 106 + v} C ${x + 115} ${y + 104 + w} ${x + 55} ${y + 102 - w} ${x} ${y + 104} Z`;
}

/** Bumpy outlined bush/hill silhouette along a baseline. */
function bushPath(x0: number, x1: number, base: number, h: number, bumps: number, seed: number): string {
  // Rounded at both ends: rises from the baseline and falls back to it.
  const step = (x1 - x0) / bumps;
  const r = step * 0.62;
  let d = `M ${x0} ${base + 60} L ${x0} ${base}`;
  for (let i = 0; i < bumps; i++) {
    const nx = x0 + step * (i + 1);
    const ny = i === bumps - 1 ? base : base - h * (0.45 + 0.55 * hash(seed + i));
    d += ` A ${r} ${r} 0 0 1 ${nx} ${ny}`;
  }
  return `${d} L ${x1} ${base + 60} Z`;
}

function grassPath(y: number, seed: number): string {
  let d = "";
  for (let x = -30; x < W + 30; x += 8) {
    const h = 10 + 16 * hash(seed + x);
    const lean = (hash(seed + x * 3) - 0.5) * 8;
    d += `M ${x} ${y} Q ${x + 2 + lean * 0.5} ${y - h * 0.6} ${x + 4 + lean} ${y - h} Q ${x + 5} ${y - h * 0.5} ${x + 8} ${y} `;
  }
  return d;
}

// The fairway's centerline — the mowing bands are concentric strokes along it.
const FAIRWAY = `M 300 ${MAP_START_Y + 300} C 110 2750, 520 2350, 330 1850 S 130 950, 320 640 S 335 380, ${CUP.x} ${CUP.y}`;

export function ShotReveal({
  slice,
  scene,
  soundOn,
  origin,
  onDone,
}: {
  slice: WheelEntry;
  scene: SimScene;
  soundOn: boolean;
  /** Viewport box of the wheel's hub ball — the reveal starts from it. */
  origin: DOMRect | null;
  onDone: (slice: WheelEntry) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<SVGGElement>(null);
  const teeShotRef = useRef<SVGGElement>(null);
  const teeRef = useRef<SVGGElement>(null);
  const clubRef = useRef<SVGGElement>(null);
  const burstRef = useRef<SVGGElement>(null);
  const flashRef = useRef<SVGRectElement>(null);
  const skyRef = useRef<SVGGElement>(null);
  const mapRef = useRef<SVGGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const speedRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const ballRef = useRef<SVGGElement>(null);
  const whipRef = useRef<SVGGElement>(null);
  const pinRef = useRef<SVGGElement>(null);
  const flagRef = useRef<SVGPathElement>(null);
  const flagShadowRef = useRef<SVGPathElement>(null);
  const skipRef = useRef(false);
  const [named, setNamed] = useState(false);

  const water = scene.water ?? "#7ccbe8";
  const sand = scene.sand ?? "#f3e3a2";
  const tee = scene.tee ?? "#2b59ff";

  useEffect(() => {
    // Riso grain: one noise tile, nudged around at 12fps so it "boils".
    const tile = document.createElement("canvas");
    tile.width = tile.height = 180;
    const g = tile.getContext("2d");
    if (g) {
      const img = g.createImageData(180, 180);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() < 0.5 ? 0 : 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = Math.random() < 0.55 ? 34 : 0;
      }
      g.putImageData(img, 0, 0);
      if (grainRef.current) grainRef.current.style.backgroundImage = `url(${tile.toDataURL()})`;
    }

    // Wheel hub position → SVG coords, so the hand-off is exact.
    let from: Origin = null;
    const ctm = svgRef.current?.getScreenCTM();
    if (ctm && origin) {
      const p = new DOMPoint(origin.left + origin.width / 2, origin.top + origin.height / 2).matrixTransform(
        ctm.inverse()
      );
      from = { x: p.x, y: p.y, r: origin.width / 2 / ctm.a };
    }

    let raf = 0;
    const start = performance.now();
    const fired = new Set<string>();
    const once = (key: string, fn: () => void) => {
      if (!fired.has(key)) {
        fired.add(key);
        fn();
      }
    };
    const show = (el: Element | null, on: boolean) => el?.setAttribute("visibility", on ? "visible" : "hidden");
    const attr = (el: Element | null, name: string, v: string | number) => el?.setAttribute(name, String(v));

    const loop = (now: number) => {
      const t = skipRef.current ? Math.max(now - start, T.named) : now - start;

      // ── backdrop fades in behind the hub ball ───────────────────────
      attr(backdropRef.current, "opacity", easeOut(seg(t, 0, 450)));

      // ── tee close-up + smash ─────────────────────────────────────────
      show(teeShotRef.current, t < T.sky);
      const shake = t > T.impact && t < T.impact + 320 ? (1 - seg(t, T.impact, T.impact + 320)) * 9 : 0;
      attr(teeShotRef.current, "transform", `translate(${shake * Math.sin(t * 0.09)} ${shake * Math.cos(t * 0.13)})`);
      attr(teeRef.current, "transform", `translate(0 ${lerp(90, 0, backOut(seg(t, 150, T.settle)))})`);
      const cu = seg(t, T.club, T.impact);
      const clubX = lerp(-420, 0, easeIn(cu)) + (t > T.impact ? easeOut(seg(t, T.impact, T.impact + 260)) * 700 : 0);
      attr(clubRef.current, "transform", `translate(${clubX} 0)`);
      show(clubRef.current, t >= T.club && t < T.impact + 260);
      const bu = seg(t, T.impact, T.impact + 380);
      show(burstRef.current, t >= T.impact && bu < 1);
      attr(
        burstRef.current,
        "transform",
        `translate(${TEE_BALL.x} ${TEE_BALL.y}) scale(${0.3 + backOut(Math.min(bu * 2.2, 1)) * 1.05}) rotate(${bu * 25})`
      );
      attr(burstRef.current, "opacity", 1 - easeIn(bu));
      attr(flashRef.current, "opacity", t >= T.impact ? 1 - seg(t, T.impact + 60, T.impact + 220) : 0);

      // ── launch into the sky ──────────────────────────────────────────
      show(skyRef.current, t >= T.sky && t < T.map + 120);

      // ── top-down chase + green ───────────────────────────────────────
      const onMap = t >= T.map && t < T.pin;
      show(mapRef.current, onMap);
      const gb = greenBall(t);
      const cam = mapCamera(t, t < T.land ? LAND : gb);
      attr(worldRef.current, "transform", `translate(${C} ${C}) scale(${cam.s}) translate(${-cam.x} ${-cam.y})`);
      const step = Math.floor(t / 70);
      show(speedRef.current, onMap && t < T.land - 250);
      speedRef.current?.querySelectorAll("path").forEach((el, i) => {
        const left = i % 2 === 0;
        const y = (hash(step * 13 + i) * W) | 0;
        const len = 60 + 90 * hash(step * 7 + i);
        attr(el, "transform", `translate(${left ? 0 : W} ${y}) scale(${left ? 1 : -1} 1)`);
        attr(el, "d", `M 0 -5 L ${len} 0 L 0 5 Z`);
        attr(el, "opacity", hash(step * 3 + i) > 0.35 ? 0.9 : 0);
      });

      // ── the ball (screen space) + its shadow ─────────────────────────
      const b = ballScreen(t, from);
      show(ballRef.current, t < T.pin && b.o > 0.01);
      attr(ballRef.current, "opacity", b.o);
      attr(ballRef.current, "transform", `translate(${b.x} ${b.y}) scale(${b.sx} ${b.sy}) rotate(${b.rot}) scale(${b.r / 50})`);
      if (t >= T.map && t < T.holed) {
        // Altitude = shadow offset: far below while high, kissing it on landing.
        const alt = t < T.land ? 1 - Math.pow(seg(t, T.map, T.land), 2) : (gb.h / 9) * 0.3;
        attr(shadowRef.current, "cx", b.x + 75 * alt);
        attr(shadowRef.current, "cy", b.y + 115 * alt + b.r * 0.55);
        attr(shadowRef.current, "rx", b.r * (0.8 + 0.25 * (1 - alt)));
        attr(shadowRef.current, "ry", b.r * (0.42 + 0.12 * (1 - alt)));
        attr(shadowRef.current, "opacity", (0.18 + 0.3 * (1 - alt)) * b.o);
      } else {
        attr(shadowRef.current, "opacity", 0);
      }

      // ── whip-tilt up to the pin ──────────────────────────────────────
      show(whipRef.current, t >= T.whip && t < T.pin + 80);
      attr(whipRef.current, "transform", `translate(0 ${lerp(-W - 120, 0, easeIn(seg(t, T.whip, T.pin)))})`);
      show(pinRef.current, t >= T.pin);
      attr(pinRef.current, "transform", `translate(0 ${lerp(260, 0, easeOut(seg(t, T.pin, T.named)))})`);
      const fp = flagPath(now);
      attr(flagRef.current, "d", fp);
      attr(flagShadowRef.current, "d", fp);

      // Grain boils at 12fps.
      if (grainRef.current) {
        const gs = Math.floor(now / 83);
        grainRef.current.style.backgroundPosition = `${(hash(gs) * 180) | 0}px ${(hash(gs + 9) * 180) | 0}px`;
      }

      if (soundOn && !skipRef.current) {
        if (t >= T.impact - 160) once("strike", sfx.strike);
        if (t >= T.land) once("land", () => sfx.thud(0.13));
        if (t >= T.hop) once("hop", () => sfx.thud(0.06));
        if (t >= T.drop) once("cup", sfx.cup);
      }
      if (t >= T.named) {
        once("named", () => {
          setNamed(true);
          if (soundOn) sfx.chime();
          import("canvas-confetti").then(({ default: confetti }) => {
            confetti({
              particleCount: 110,
              spread: 85,
              startVelocity: 40,
              origin: { x: 0.5, y: 0.45 },
              colors: [scene.flag, CREAM, scene.green, sand, water],
              shapes: ["square"],
              scalar: 1.1,
            });
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

  const ink = { stroke: RISO_INK, strokeWidth: 3, strokeLinejoin: "round" as const };

  return (
    <motion.div
      className="fixed inset-0 z-30 cursor-pointer overflow-hidden"
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      onClick={() => {
        skipRef.current = true;
      }}
      role="presentation"
    >
      <svg ref={svgRef} viewBox={`0 0 ${W} ${W}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <g ref={backdropRef} opacity="0">
          {/* ── Tee close-up ─────────────────────────────────────────── */}
          <g ref={teeShotRef}>
            <rect x={-W} y={-W} width={W * 3} height={W * 3} fill={scene.skyTop} />
            <rect x={-W} y={250} width={W * 3} height={W} fill={scene.skyBottom} opacity="0.35" />
            <Cloud x={95} y={120} s={1} />
            <Cloud x={500} y={80} s={0.75} />
            <path d={bushPath(-60, 230, 430, 120, 4, 3)} fill={scene.hills} {...ink} />
            <path d={bushPath(370, 680, 430, 135, 4, 9)} fill={scene.hills} {...ink} />
            <path d={bushPath(-60, 680, 440, 38, 9, 21)} fill={scene.trees} {...ink} />
            <rect x={-W} y={438} width={W * 3} height={W} fill={scene.rough} />
            <g ref={teeRef}>
              <path
                d={`M ${C - 26} 418 L ${C + 26} 418 L ${C + 11} 432 L ${C + 5} 478 L ${C - 5} 478 L ${C - 11} 432 Z`}
                fill={tee}
                {...ink}
              />
            </g>
            <path d={grassPath(462, 5)} fill={scene.trees} stroke={RISO_INK} strokeWidth="1.6" />
            <path d={grassPath(490, 11)} fill={scene.rough} stroke={RISO_INK} strokeWidth="1.6" />
            {/* Clubhead swinging through */}
            <g ref={clubRef} visibility="hidden">
              {[0, 1, 2].map((i) => (
                <path
                  key={i}
                  d={`M ${-300 + i * 40} ${360 + i * 22} L ${120 + i * 10} ${362 + i * 22}`}
                  stroke={CREAM}
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity={0.85 - i * 0.2}
                />
              ))}
              <path d="M 120 330 L -40 -400" stroke={RISO_INK} strokeWidth="9" strokeLinecap="round" />
              <path d="M 108 318 Q 190 300 228 340 Q 246 372 214 400 Q 160 424 104 404 Q 86 360 108 318 Z" fill="#2f3438" {...ink} />
              <path d="M 222 338 Q 236 370 214 398" stroke={CREAM} strokeWidth="4" fill="none" strokeLinecap="round" />
            </g>
            <g ref={burstRef} visibility="hidden">
              <Starburst />
            </g>
          </g>

          {/* ── Launch: speckled sky ─────────────────────────────────── */}
          <g ref={skyRef} visibility="hidden">
            <rect x={-W} y={-W} width={W * 3} height={W * 3} fill={scene.skyTop} />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path
                key={i}
                d={`M ${120 + i * 75} 620 L ${126 + i * 75} ${480 - (i % 3) * 60}`}
                stroke={CREAM}
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.7"
              />
            ))}
          </g>

          {/* ── Top-down chase + green ───────────────────────────────── */}
          <g ref={mapRef} visibility="hidden">
            <rect x={-W} y={-W} width={W * 3} height={W * 3} fill={scene.rough} />
            <g ref={worldRef}>
              <Course scene={scene} water={water} sand={sand} />
            </g>
            <g ref={speedRef}>
              {Array.from({ length: 10 }, (_, i) => (
                <path key={i} fill={CREAM} stroke={RISO_INK} strokeWidth="1.5" />
              ))}
            </g>
          </g>
        </g>

        {/* Shadow + ball sit above every backdrop at full opacity from frame
            one, so the wheel's hub ball never blinks during the hand-off. */}
        <ellipse ref={shadowRef} fill={RISO_INK} opacity="0" />
        <g ref={ballRef}>
          <RisoBallArt outline={3} />
        </g>

        {/* White flash at impact */}
        <rect ref={flashRef} x={-W} y={-W} width={W * 3} height={W * 3} fill="#ffffff" opacity="0" pointerEvents="none" />

        {/* ── Pin + flag (side view) ─────────────────────────────────── */}
        <g ref={pinRef} visibility="hidden">
          <rect x={-W} y={-W} width={W * 3} height={W * 3} fill={scene.skyTop} />
          <rect x={-W} y={300} width={W * 3} height={W} fill={scene.skyBottom} opacity="0.35" />
          <circle cx="470" cy="190" r="46" fill={sand} {...ink} />
          <Cloud x={110} y={110} s={0.9} />
          <Cloud x={430} y={330} s={0.6} />
          <path d={bushPath(-60, 680, 470, 70, 7, 33)} fill={scene.hills} {...ink} />
          <path d="M -100 640 L -100 505 Q 300 452 700 505 L 700 640 Z" fill={scene.green} {...ink} />
          <ellipse cx="240" cy="488" rx="16" ry="5" fill={RISO_INK} />
          <path ref={flagShadowRef} transform="translate(6 6)" fill={RISO_INK} opacity="0.22" />
          <rect x="235" y="146" width="9" height="344" rx="3" fill={CREAM} {...ink} strokeWidth={2.5} />
          <path ref={flagRef} fill={scene.flag} {...ink} />
          <circle cx="239.5" cy="143" r="7" fill={CREAM} {...ink} strokeWidth={2.5} />
        </g>

        {/* ── Whip-tilt transition ───────────────────────────────────── */}
        <g ref={whipRef} visibility="hidden">
          <rect x={-W} y={-80} width={W * 3} height={W + 200} fill={scene.skyTop} />
          <rect x={-W} y={W - 60} width={W * 3} height={180} fill={scene.green} />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <path key={i} d={`M ${40 + i * 90} -40 L ${46 + i * 90} ${W + 40}`} stroke={CREAM} strokeWidth="5" opacity="0.6" />
          ))}
        </g>
      </svg>

      {/* Riso grain over everything */}
      <div
        ref={grainRef}
        className="pointer-events-none absolute inset-0"
        style={{ mixBlendMode: "multiply", opacity: 0.55, backgroundRepeat: "repeat" }}
      />

      <AnimatePresence>
        {named && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-[57%] flex justify-center px-4"
            initial={{ opacity: 0, y: 40, rotate: -4, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, rotate: -1.5, scale: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 15 }}
          >
            <div
              className="max-w-[92vw] rounded-xl px-6 py-4 text-center"
              style={{
                background: CREAM,
                color: RISO_INK,
                border: `3px solid ${RISO_INK}`,
                boxShadow: `7px 7px 0 ${RISO_INK}`,
              }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.3em]">⛳ Tonight&apos;s course</p>
              <p className="sim-heading mt-1 text-[clamp(1.6rem,6vw,3.2rem)] font-bold leading-tight">
                <SlotText text={slice.courseName} />
              </p>
              <p className="mt-1 text-sm opacity-75">
                Suggested by {slice.suggesters.map((s) => s.name).join(", ")}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!named && (
        <p className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-xs font-bold uppercase tracking-widest text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
          Tap to skip
        </p>
      )}
    </motion.div>
  );
}

/** The striped, winding course seen from above (world coords). */
function Course({ scene, water, sand }: { scene: SimScene; water: string; sand: string }) {
  const ink = { stroke: RISO_INK, strokeWidth: 3, strokeLinejoin: "round" as const };
  const trees: [number, number, number][] = [
    [60, 2950, 30], [95, 2900, 22], [540, 2700, 34], [575, 2640, 24], [40, 2350, 28],
    [560, 2050, 30], [520, 1990, 22], [70, 1600, 34], [30, 1540, 24], [560, 1350, 28],
    [600, 1290, 20], [60, 1050, 26], [540, 820, 32], [580, 760, 22], [80, 560, 30],
    [560, 420, 26], [40, 300, 22], [600, 200, 30],
  ];
  return (
    <g>
      {/* Mowing bands: concentric strokes along one centerline */}
      <path d={FAIRWAY} fill="none" stroke={RISO_INK} strokeWidth="286" strokeLinecap="round" />
      <path d={FAIRWAY} fill="none" stroke={scene.fairway} strokeWidth="280" strokeLinecap="round" />
      <path d={FAIRWAY} fill="none" stroke={scene.green} strokeWidth="210" strokeLinecap="round" />
      <path d={FAIRWAY} fill="none" stroke={scene.fairway} strokeWidth="140" strokeLinecap="round" />
      <path d={FAIRWAY} fill="none" stroke={scene.green} strokeWidth="70" strokeLinecap="round" />
      {/* Hazards */}
      <path d="M 440 2330 q 40 -40 90 -10 q 30 40 -10 60 q -60 20 -80 -50 z" fill={sand} {...ink} />
      <path d="M 120 1450 q 30 -50 80 -20 q 20 50 -30 60 q -50 10 -50 -40 z" fill={sand} {...ink} />
      <path d="M 60 2050 q 40 -80 120 -50 q 60 40 10 100 q -90 50 -130 -50 z" fill={water} {...ink} />
      <path d="M 470 520 q 50 -60 110 -20 q 30 60 -30 90 q -70 20 -80 -70 z" fill={water} {...ink} />
      {trees.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={scene.trees} {...ink} />
      ))}
      {/* Green complex: layered contours, then the cup */}
      <path
        d={`M ${CUP.x - 150} ${CUP.y + 30} Q ${CUP.x - 140} ${CUP.y - 120} ${CUP.x} ${CUP.y - 125} Q ${CUP.x + 150} ${CUP.y - 110} ${CUP.x + 145} ${CUP.y + 20} Q ${CUP.x + 120} ${CUP.y + 150} ${CUP.x - 10} ${CUP.y + 140} Q ${CUP.x - 155} ${CUP.y + 130} ${CUP.x - 150} ${CUP.y + 30} Z`}
        fill={scene.fairway}
        {...ink}
      />
      <path
        d={`M ${CUP.x - 110} ${CUP.y + 20} Q ${CUP.x - 100} ${CUP.y - 90} ${CUP.x + 5} ${CUP.y - 92} Q ${CUP.x + 112} ${CUP.y - 80} ${CUP.x + 108} ${CUP.y + 15} Q ${CUP.x + 90} ${CUP.y + 105} ${CUP.x - 5} ${CUP.y + 100} Q ${CUP.x - 115} ${CUP.y + 95} ${CUP.x - 110} ${CUP.y + 20} Z`}
        fill={scene.green}
        {...ink}
      />
      {/* A real cup is ~2.5x the ball's width (ball ≈ 16 world units here). */}
      <ellipse cx={CUP.x} cy={CUP.y} rx="30" ry="22" fill={RISO_INK} />
      <path d={`M ${CUP.x - 28} ${CUP.y - 4} A 30 22 0 0 1 ${CUP.x + 28} ${CUP.y - 4}`} fill="none" stroke={CREAM} strokeWidth="2" opacity="0.55" />
    </g>
  );
}

function Starburst() {
  const spikes = 14;
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 150 + 60 * hash(i) : 78;
    pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
  }
  return <polygon points={pts.join(" ")} fill={CREAM} stroke={RISO_INK} strokeWidth="3" strokeLinejoin="round" />;
}

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M -70 20 Q -78 -8 -48 -12 Q -40 -42 -6 -36 Q 14 -58 42 -38 Q 76 -40 72 -6 Q 92 6 74 22 Z"
        fill={CREAM}
        stroke={RISO_INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </g>
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
        const shown = settled ? c : /[a-z]/.test(c) ? roll.toLowerCase() : /[A-Z]/.test(c) ? roll : c;
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
