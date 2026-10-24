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

export const SIM_THEMES: {
  id: SimThemeId;
  label: string;
  swatch: string;
  ring?: string;
  wheel: string[];
}[] = [
  {
    id: "classic",
    label: "Classic Green",
    swatch: "#228B22",
    wheel: [
      "#228B22", "#2E8B57", "#3CB371", "#90EE90", "#7CFC00", "#32CD32",
      "#00FA9A", "#00FF7F", "#66CDAA", "#8FBC8F", "#20B2AA", "#008B8B",
    ],
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
  },
  {
    id: "links-coastal",
    label: "Links Coastal",
    swatch: "#4A6FA5",
    wheel: [
      "#4A6FA5", "#3A5A8A", "#7AA0CC", "#B8D4D9", "#C8B998", "#5A8FB5",
      "#6B8FA5", "#A0C4D0", "#8AB0C8", "#4A7F6A", "#7B9AAB", "#DDD0B5",
    ],
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
  },
];

export function simTheme(id: string | null | undefined) {
  return SIM_THEMES.find((t) => t.id === id) ?? SIM_THEMES[0];
}
