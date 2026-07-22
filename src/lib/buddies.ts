// Same 5-color categorical palette a previous version used for color-per-runner
// on the map, now keyed by buddy name so sidebar and map tooltips stay in sync.
export const BUDDY_COLORS: Record<string, string> = {
  Nico: "#2a78d6",
  Marita: "#eb6834",
  Fynn: "#1baf7a",
  Sjoerd: "#eda100",
  Cecile: "#e87ba4",
};

const FALLBACK_COLOR = "#9c9b93";

export function colorForBuddy(name: string): string {
  return BUDDY_COLORS[name] ?? FALLBACK_COLOR;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255);
  const linear = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

// Picks whichever of black/white gives the higher WCAG contrast ratio against
// the given background, so the badge text stays legible for any buddy color.
export function readableTextColor(bgHex: string): string {
  const l = relativeLuminance(bgHex);
  const contrastWithWhite = 1.05 / (l + 0.05);
  const contrastWithBlack = (l + 0.05) / 0.05;
  return contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#1a1a1a";
}
