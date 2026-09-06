import { Profile, Task, TaskCompletion } from "../types";
import { compareISO, todayISO } from "./dates";
import { isTaskForDate } from "./recurrence";

export type DayAggregateStatus =
  | "empty"
  | "all_done"
  | "partial"
  | "missed"
  | "pending";

export interface TaskDayStatus {
  task: Task;
  done: boolean;
  completion?: TaskCompletion;
}

export interface ChildDayBreakdown {
  child: Profile;
  total: number;
  done: number;
  status: DayAggregateStatus;
  tasks: TaskDayStatus[];
}

export interface DayOverview {
  date: string;
  total: number;
  done: number;
  status: DayAggregateStatus;
  children: ChildDayBreakdown[];
}

function statusFromCounts(
  total: number,
  done: number,
  date: string,
  today = todayISO()
): DayAggregateStatus {
  if (total === 0) return "empty";
  if (done >= total) return "all_done";
  if (done > 0) return "partial";
  // none done
  if (compareISO(date, today) < 0) return "missed";
  return "pending"; // today or future
}

export function tasksForChildOnDate(tasks: Task[], childId: string, date: string): Task[] {
  const d = (() => {
    const [y, m, day] = date.split("-").map(Number);
    return new Date(y, m - 1, day);
  })();
  return tasks
    .filter((t) => t.childId === childId && isTaskForDate(t, d))
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function buildDayOverview(
  date: string,
  tasks: Task[],
  completions: TaskCompletion[],
  children: Profile[],
  today = todayISO()
): DayOverview {
  const childrenBreakdown: ChildDayBreakdown[] = children.map((child) => {
    const dayTasks = tasksForChildOnDate(tasks, child.id, date);
    const taskStatuses: TaskDayStatus[] = dayTasks.map((task) => {
      const completion = completions.find((c) => c.taskId === task.id && c.date === date);
      return { task, done: !!completion, completion };
    });
    const total = taskStatuses.length;
    const done = taskStatuses.filter((t) => t.done).length;
    return {
      child,
      total,
      done,
      status: statusFromCounts(total, done, date, today),
      tasks: taskStatuses,
    };
  });

  const total = childrenBreakdown.reduce((s, c) => s + c.total, 0);
  const done = childrenBreakdown.reduce((s, c) => s + c.done, 0);

  return {
    date,
    total,
    done,
    status: statusFromCounts(total, done, date, today),
    children: childrenBreakdown,
  };
}

export function statusColor(status: DayAggregateStatus): string {
  switch (status) {
    case "all_done":
      return "#22A06B";
    case "partial":
      return "#F5A524";
    case "missed":
      return "#E5484D";
    case "pending":
      return "#4F6EF7";
    case "empty":
    default:
      return "#E5E7EB";
  }
}

export function statusLabelFr(status: DayAggregateStatus): string {
  switch (status) {
    case "all_done":
      return "Tout fait";
    case "partial":
      return "Partiel";
    case "missed":
      return "Manqué";
    case "pending":
      return "En cours";
    case "empty":
      return "Aucune tâche";
  }
}
