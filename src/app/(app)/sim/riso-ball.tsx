/**
 * The riso-style golf ball, drawn at radius 50 around (0,0) — scale it with
 * a transform. Shared by the wheel hub and the reveal so the hub ball and
 * the ball that gets teed up are visibly the same object.
 */
export const RISO_INK = "#1c1b19";

// Crescent dimples in the lower-right "shadow" side, like the reference.
const DIMPLES: [number, number, number, number][] = [
  [-33, 6, 75, 0.9],
  [-26, 21, 55, 1],
  [-13, 32, 30, 1.05],
  [3, 37, 10, 1.05],
  [19, 33, -15, 1],
  [32, 22, -40, 0.95],
  [38, 6, -65, 0.85],
  [-16, 14, 45, 0.8],
  [0, 21, 15, 0.85],
  [16, 18, -20, 0.8],
  [26, 6, -50, 0.75],
];

export function RisoBallArt({ outline = 3 }: { outline?: number }) {
  return (
    <g>
      <circle r="50" fill="#ffffff" />
      {/* Soft core shadow on the dimpled side */}
      <path d="M -46 8 A 50 50 0 0 0 46 8 A 56 46 0 0 1 -46 8 Z" fill="#e7e4dc" />
      {DIMPLES.map(([x, y, rot, s], i) => (
        <path
          key={i}
          transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}
          d="M -6.5 -1.5 A 7 5 0 0 0 6.5 -1.5 A 7 7.5 0 0 1 -6.5 -1.5 Z"
          fill={RISO_INK}
        />
      ))}
      <circle r="50" fill="none" stroke={RISO_INK} strokeWidth={outline} vectorEffect="non-scaling-stroke" />
    </g>
  );
}
