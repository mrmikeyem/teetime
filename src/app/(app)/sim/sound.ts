"use client";

/**
 * Tiny synthesized sound effects (Web Audio — no audio files to ship).
 * Every call is best-effort: audio is a nicety and must never throw into
 * an animation.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

export function tone(opts: {
  from: number;
  to: number;
  duration: number;
  volume: number;
  type?: OscillatorType;
  delay?: number;
}) {
  const a = audio();
  if (!a) return;
  try {
    const t = a.currentTime + (opts.delay ?? 0);
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = opts.type ?? "triangle";
    osc.frequency.setValueAtTime(opts.from, t);
    osc.frequency.exponentialRampToValueAtTime(opts.to, t + opts.duration);
    gain.gain.setValueAtTime(opts.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.duration);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + opts.duration + 0.02);
  } catch {
    // ignore
  }
}

/** Short filtered noise burst — the "whoosh" / "thwack" texture. */
export function noise(opts: { duration: number; volume: number; highpass?: number; delay?: number }) {
  const a = audio();
  if (!a) return;
  try {
    const t = a.currentTime + (opts.delay ?? 0);
    const len = Math.max(1, Math.floor(a.sampleRate * opts.duration));
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const filter = a.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = opts.highpass ?? 1200;
    const gain = a.createGain();
    gain.gain.value = opts.volume;
    src.connect(filter).connect(gain).connect(a.destination);
    src.start(t);
  } catch {
    // ignore
  }
}

export const sfx = {
  /** Wheel slice tick. */
  tick: () => tone({ from: 1500, to: 500, duration: 0.05, volume: 0.08 }),
  /** Downswing whoosh into a crisp strike. */
  strike: () => {
    noise({ duration: 0.22, volume: 0.05, highpass: 800 });
    tone({ from: 2600, to: 1400, duration: 0.07, volume: 0.14, delay: 0.16 });
    noise({ duration: 0.04, volume: 0.18, highpass: 2500, delay: 0.16 });
  },
  /** Soft landing thud. */
  thud: (volume = 0.12) => tone({ from: 180, to: 90, duration: 0.09, volume, type: "sine" }),
  /** Ball rattling into the cup. */
  cup: () => {
    tone({ from: 520, to: 300, duration: 0.06, volume: 0.12 });
    tone({ from: 460, to: 260, duration: 0.06, volume: 0.09, delay: 0.09 });
    tone({ from: 380, to: 200, duration: 0.08, volume: 0.07, delay: 0.17 });
  },
  /** Reveal chime. */
  chime: () => {
    tone({ from: 784, to: 780, duration: 0.5, volume: 0.07, type: "sine" });
    tone({ from: 1175, to: 1170, duration: 0.6, volume: 0.05, type: "sine", delay: 0.08 });
    tone({ from: 1568, to: 1560, duration: 0.8, volume: 0.04, type: "sine", delay: 0.16 });
  },
};
