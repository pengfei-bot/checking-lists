export type Role = "parent" | "child";

export type Recurrence = "daily" | "weekdays" | "once";

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
