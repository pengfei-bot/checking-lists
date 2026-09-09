export type Role = "parent" | "child";

export type Recurrence = "daily" | "weekdays" | "once" | "weekly" | "every_n_weeks";

export interface Profile {
  id: string;
  name: string;
  role: Role;
  emoji: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  childId: string;
  /** HH:mm local time for reminder / display */
  time: string;
  recurrence: Recurrence;
  reminderEnabled: boolean;
  /** ISO date YYYY-MM-DD for once tasks; optional for recurring */
  onceDate?: string;
  /** Weeks between occurrences for every_n_weeks (2–12 UI; DB allows 1–52) */
  intervalWeeks?: number;
  /** ISO YYYY-MM-DD — first occurrence / weekday anchor for weekly & every_n_weeks */
  startDate?: string;
  /** ISO YYYY-MM-DD inclusive end for recurring types */
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCompletion {
  id: string;
  taskId: string;
  childId: string;
  /** YYYY-MM-DD */
  date: string;
  completedAt: string;
  photoUri?: string;
}

export interface AppState {
  profiles: Profile[];
  tasks: Task[];
  completions: TaskCompletion[];
  seeded: boolean;
  currentProfileId: string | null;
}
