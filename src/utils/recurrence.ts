import { Task } from "../types";
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
      return "Tous les jours";
    case "weekdays":
      return "Jours de semaine";
    case "once":
      return "Une seule fois";
  }
}
