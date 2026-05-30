export const SPENT_OK = "hsl(142 71% 45% / 0.85)";
export const SPENT_WARN = "hsl(43 96% 56% / 0.85)";
export const SPENT_OVER = "hsl(0 72% 51% / 0.85)";

export function cssHsl(variable: string, alpha?: number): string {
  if (typeof window === "undefined") return "#000000";
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  if (!value) return "#000000";
  return alpha === undefined ? `hsl(${value})` : `hsl(${value} / ${alpha})`;
}
