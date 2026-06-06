/**
 * Parses a calendar date string in "YYYY-MM-DD" format into a local Date,
 * avoiding timezone-shift issues that occur with `new Date("YYYY-MM-DD")`.
 */
export function parseLocalCalendarDate(dateValue: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** Returns a "YYYY-MM" key for the month of the given date. */
export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Returns the "YYYY-MM" key for the month previous to the given key. Returns "" on invalid input. */
export function getPreviousMonthKey(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return "";
  const d = new Date(Number(match[1]), Number(match[2]) - 2, 1);
  return getMonthKey(d);
}

/** Converts a "YYYY-MM" key to a human-readable month label, e.g. "January 2025". */
export function formatMonthLabelFromKey(key: string): string {
  const date = parseLocalCalendarDate(`${key}-01`);
  if (!date) return "Current month";
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Formats a datetime string (or null) to a locale string, e.g. for last-sync timestamps. Returns "Never" on null/invalid. */
export function formatDate(value: string | null): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Never";
  return parsed.toLocaleString();
}

/** Formats a "YYYY-MM-DD" string to a short label, e.g. "Jan 5". */
export function formatDateLabel(dateValue: string): string {
  const parsed = parseLocalCalendarDate(dateValue);
  if (!parsed) return dateValue;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
