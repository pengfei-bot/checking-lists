export function todayISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatFrenchDate(iso: string): string {
  const date = parseISODate(iso);
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatFrenchMonthYear(year: number, monthIndex: number): string {
  const date = new Date(year, monthIndex, 1);
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/** Monday-first weekday short labels (FR). */
export const WEEKDAY_LABELS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function isWeekday(date = new Date()): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function parseTimeToDate(time: string, base = new Date()): Date {
  const [hh, mm] = time.split(":").map(Number);
  const d = new Date(base);
  d.setHours(hh, mm, 0, 0);
  return d;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function addDaysISO(iso: string, delta: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + delta);
  return todayISO(d);
}

export function compareISO(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Days in month (monthIndex 0-11). */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Monday-first offset for the 1st of the month (0 = Monday … 6 = Sunday).
 */
export function mondayFirstOffset(year: number, monthIndex: number): number {
  const dow = new Date(year, monthIndex, 1).getDay(); // 0=Sun
  return dow === 0 ? 6 : dow - 1;
}

export function isoFromParts(year: number, monthIndex: number, day: number): string {
  return todayISO(new Date(year, monthIndex, day));
}
