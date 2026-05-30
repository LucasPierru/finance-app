import { writable } from "svelte/store";

export type ThemeName = "dark" | "light" | "ocean" | "forest" | "sunset" | "midnight";

const STORAGE_KEY = "finance_theme";
const DEFAULT_THEME: ThemeName = "dark";

function isTheme(value: string): value is ThemeName {
  return ["dark", "light", "ocean", "forest", "sunset", "midnight"].includes(value);
}

function applyTheme(theme: ThemeName) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export const theme = writable<ThemeName>(DEFAULT_THEME);

export function setTheme(nextTheme: ThemeName) {
  theme.set(nextTheme);
  applyTheme(nextTheme);

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, nextTheme);
  }
}

export function initializeTheme() {
  if (typeof window === "undefined") return;

  const storedTheme = localStorage.getItem(STORAGE_KEY);
  const resolvedTheme = storedTheme && isTheme(storedTheme) ? storedTheme : DEFAULT_THEME;
  theme.set(resolvedTheme);
  applyTheme(resolvedTheme);
}
