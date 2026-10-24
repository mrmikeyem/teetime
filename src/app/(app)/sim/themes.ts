/**
 * The six wheel themes ported from the old Golf Course Wheel. Page tokens
 * live in sim.css under [data-sim-theme]; slice colors live here because
 * the SVG wheel cycles through them per slice.
 */
export type SimThemeId =
  | "classic"
  | "dark-luxe"
  | "retro-scorecard"
  | "neon-night"
  | "links-coastal"
  | "masters";

/** Palette for the tee-shot reveal scene. */
export type SimScene = {
  skyTop: string;
  skyBottom: string;
  sun: string;
  hills: string;
  trees: string;
  rough: string;
  fairway: string;
  green: string;
  flag: string;
  golfer: string;
  /** Flowering shrubs (Masters azaleas). */
  bushes?: string;
  /** Riso extras for the ball's-eye reveal (defaults in shot-reveal.tsx). */
  water?: string;
  sand?: string;
  tee?: string;
};

export const SIM_THEMES: {
  id: SimThemeId;
  label: string;
  swatch: string;
  ring?: string;
  wheel: string[];
  scene: SimScene;
}[] = [
  {
    id: "classic",
    label: "Classic Green",
    swatch: "#228B22",
    wheel: [
      "#228B22", "#2E8B57", "#3CB371", "#90EE90", "#7CFC00", "#32CD32",
      "#00FA9A", "#00FF7F", "#66CDAA", "#8FBC8F", "#20B2AA", "#008B8B",
    ],
    scene: { skyTop: "#5fb4f0", skyBottom: "#d8f1ff", sun: "#fff6c4", hills: "#5c9e5a", trees: "#2f6b34", rough: "#3f8f3a", fairway: "#5cb85c", green: "#86e05c", flag: "#e53935", golfer: "#16241a" },
  },
  {
    id: "dark-luxe",
    label: "Dark Luxe",
    swatch: "#0d0c0a",
    ring: "#C9A84C",
    wheel: [
      "#C9A84C", "#A8882A", "#8B7535", "#D4AF37", "#B8941F", "#E8D5A3",
      "#917428", "#C5A028", "#7A6420", "#DAC06A", "#6B5518", "#A89040",
    ],
    scene: { skyTop: "#0d0c0a", skyBottom: "#4a3b1f", sun: "#e8d5a3", hills: "#221e17", trees: "#17140f", rough: "#1e1b15", fairway: "#2c281e", green: "#4a4130", flag: "#c9a84c", golfer: "#c9a84c", water: "#3b5560", sand: "#a8882a", tee: "#c9a84c" },
  },
  {
    id: "retro-scorecard",
    label: "Retro Scorecard",
    swatch: "#F2EBD9",
    ring: "#3D6B3D",
    wheel: [
      "#3D6B3D", "#5A8F4A", "#6B4226", "#8B6240", "#2D4F2D", "#7A8A5A",
      "#4A6040", "#8B7D60", "#567846", "#6B5A3A", "#3A5230", "#9B8B6B",
    ],
    scene: { skyTop: "#e8dcc0", skyBottom: "#f7f1e1", sun: "#e0c9a0", hills: "#b7b08f", trees: "#6b7a4f", rough: "#8a9a62", fairway: "#a7b77a", green: "#c4d39a", flag: "#b5493a", golfer: "#4a4238", water: "#8fb5b0", sand: "#e8d4a0", tee: "#b5493a" },
  },
  {
    id: "neon-night",
    label: "Neon Night",
    swatch: "#0A0812",
    ring: "#39FF14",
    wheel: [
      "#39FF14", "#00D4FF", "#FF006E", "#BF40FF", "#FFE500", "#00FF88",
      "#FF3366", "#00BFFF", "#FF6B00", "#7B68EE", "#00FFD4", "#FF1493",
    ],
    scene: { skyTop: "#05030c", skyBottom: "#1f1040", sun: "#ff006e", hills: "#17102c", trees: "#0f0a1f", rough: "#0c0a16", fairway: "#103019", green: "#1e6b2f", flag: "#39ff14", golfer: "#00d4ff", water: "#00d4ff", sand: "#bf40ff", tee: "#ff006e" },
  },
  {
    id: "links-coastal",
    label: "Links Coastal",
    swatch: "#4A6FA5",
    wheel: [
      "#4A6FA5", "#3A5A8A", "#7AA0CC", "#B8D4D9", "#C8B998", "#5A8FB5",
      "#6B8FA5", "#A0C4D0", "#8AB0C8", "#4A7F6A", "#7B9AAB", "#DDD0B5",
    ],
    scene: { skyTop: "#8fb3d6", skyBottom: "#eef3f7", sun: "#fff8e1", hills: "#9fb7c0", trees: "#5b7f6e", rough: "#8fa67a", fairway: "#b1c48f", green: "#a8d08d", flag: "#4a6fa5", golfer: "#2a3538", water: "#4a6fa5", sand: "#ddd0b5", tee: "#c8b998" },
  },
  {
    id: "masters",
    label: "Masters",
    swatch: "#006747",
    ring: "#FDDC5C",
    wheel: [
      "#006747", "#004D35", "#008555", "#FDDC5C", "#CF4B7A", "#00805A",
      "#E8C84A", "#D4E8DA", "#005C3F", "#F0D4E0", "#007A52", "#FFE680",
    ],
    scene: { skyTop: "#5fa8e8", skyBottom: "#dff0ff", sun: "#fff3c4", hills: "#2e6b3f", trees: "#1d4a2b", rough: "#2f7a45", fairway: "#3f9a57", green: "#6cc070", flag: "#fddc5c", golfer: "#1a2a20", bushes: "#cf4b7a", water: "#5fa8e8", sand: "#fff8e1", tee: "#fddc5c" },
  },
];

export function simTheme(id: string | null | undefined) {
  return SIM_THEMES.find((t) => t.id === id) ?? SIM_THEMES[0];
}
