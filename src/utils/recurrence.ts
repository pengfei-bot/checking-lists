import { Recurrence, Task } from "../types";
import i18n from "../i18n/i18n";
import { isWeekday, parseISODate, todayISO } from "./dates";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function weeksBetween(startIso: string, dateIso: string): number {
  const start = parseISODate(startIso);
  const date = parseISODate(dateIso);
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const dateUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((dateUTC - startUTC) / 86_400_000);
  return Math.floor(days / 7);
}

function anchorIso(task: Task): string | undefined {
  if (task.startDate && ISO_DATE.test(task.startDate)) return task.startDate;
  if (task.onceDate && ISO_DATE.test(task.onceDate)) return task.onceDate;
  if (task.createdAt) {
    const d = new Date(task.createdAt);
    if (!Number.isNaN(d.getTime())) return todayISO(d);
  }
  return undefined;
}

export function isTaskForDate(task: Task, date = new Date()): boolean {
  const iso = todayISO(date);

  if (task.endDate && ISO_DATE.test(task.endDate) && iso > task.endDate) {
    return false;
  }

  const start = task.startDate && ISO_DATE.test(task.startDate) ? task.startDate : undefined;
  if (start && iso < start) {
    // Recurring tasks must not appear before startDate (once uses onceDate only).
    if (
      task.recurrence === "daily" ||
      task.recurrence === "weekdays" ||
      task.recurrence === "weekly" ||
      task.recurrence === "every_n_weeks"
    ) {
      return false;
    }
  }

  if (task.recurrence === "daily") return true;
  if (task.recurrence === "weekdays") return isWeekday(date);
  if (task.recurrence === "once") return task.onceDate === iso;

  if (task.recurrence === "weekly" || task.recurrence === "every_n_weeks") {
    const anchor = anchorIso(task);
    if (!anchor) return false;
    const anchorDow = parseISODate(anchor).getDay();
    if (date.getDay() !== anchorDow) return false;
    if (iso < anchor) return false;
    if (task.recurrence === "weekly") return true;
    const interval = task.intervalWeeks && task.intervalWeeks >= 1 ? task.intervalWeeks : 2;
    return weeksBetween(anchor, iso) % interval === 0;
  }

  return false;
}

export function recurrenceLabel(
  recurrence: Recurrence,
  intervalWeeks?: number
): string {
  switch (recurrence) {
    case "daily":
      return i18n.t("recurrence.daily");
    case "weekdays":
      return i18n.t("recurrence.weekdays");
    case "once":
      return i18n.t("recurrence.once");
    case "weekly":
      return i18n.t("recurrence.weekly");
    case "every_n_weeks":
      return i18n.t("recurrence.everyNWeeks", {
        count: intervalWeeks && intervalWeeks >= 1 ? intervalWeeks : 2,
      });
  }
}
