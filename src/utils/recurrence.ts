import { Task } from "../types";
import i18n from "../i18n/i18n";
import { isWeekday, todayISO } from "./dates";

export function isTaskForDate(task: Task, date = new Date()): boolean {
  const iso = todayISO(date);
  if (task.recurrence === "daily") return true;
  if (task.recurrence === "weekdays") return isWeekday(date);
  if (task.recurrence === "once") return task.onceDate === iso;
  return false;
}

export function recurrenceLabel(recurrence: Task["recurrence"]): string {
  switch (recurrence) {
    case "daily":
      return i18n.t("recurrence.daily");
    case "weekdays":
      return i18n.t("recurrence.weekdays");
    case "once":
      return i18n.t("recurrence.once");
  }
}
