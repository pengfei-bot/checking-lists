import { dateLocaleTag } from "../i18n/locales";

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
  return formatLocalizedDate(iso, "fr");
}

export function formatLocalizedDate(iso: string, locale: string): string {
  const date = parseISODate(iso);
  return date.toLocaleDateString(dateLocaleTag(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatFrenchMonthYear(year: number, monthIndex: number): string {
  return formatLocalizedMonthYear(year, monthIndex, "fr");
}

export function formatLocalizedMonthYear(
  year: number,
  monthIndex: number,
  locale: string
): string {
  const date = new Date(year, monthIndex, 1);
  return date.toLocaleDateString(dateLocaleTag(locale), {
    month: "long",
    year: "numeric",
  });
}

/** Monday-first weekday short labels (FR) — prefer weekdayLabelsFor(t) with i18n. */
export const WEEKDAY_LABELS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function weekdayLabelsFor(t: (key: string) => string): string[] {
  return [
    t("weekdays.mon"),
    t("weekdays.tue"),
    t("weekdays.wed"),
    t("weekdays.thu"),
    t("weekdays.fri"),
    t("weekdays.sat"),
    t("weekdays.sun"),
  ];
}

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

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function mondayFirstOffset(year: number, monthIndex: number): number {
  const dow = new Date(year, monthIndex, 1).getDay();
  return dow === 0 ? 6 : dow - 1;
}

export function isoFromParts(year: number, monthIndex: number, day: number): string {
  return todayISO(new Date(year, monthIndex, day));
}

export function formatCompletionTime(iso: string, locale: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(dateLocaleTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
  });
}
