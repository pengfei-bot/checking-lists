import { AppState, Profile, Task } from "../types";
import { todayISO, uid } from "../utils/dates";

export const PARENT_ID = "profile_parent_demo";
export const CHILD_LEO_ID = "profile_child_leo";
export const CHILD_MIA_ID = "profile_child_mia";

export function buildDemoProfiles(): Profile[] {
  return [
    {
      id: PARENT_ID,
      name: "Parent (Demo)",
      role: "parent",
      emoji: "👨‍👩‍👧",
      color: "#4F6EF7",
    },
    {
      id: CHILD_LEO_ID,
      name: "Léo",
      role: "child",
      emoji: "🦁",
      color: "#FF8A65",
    },
    {
      id: CHILD_MIA_ID,
      name: "Mia",
      role: "child",
      emoji: "🦄",
      color: "#4FC3F7",
    },
  ];
}

export function buildDemoTasks(now = new Date()): Task[] {
  const createdAt = now.toISOString();
  const once = todayISO(now);
  return [
    {
      id: uid("task"),
      title: "Se brosser les dents",
      childId: CHILD_LEO_ID,
      time: "07:30",
      recurrence: "daily",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid("task"),
      title: "Ranger son cartable",
      childId: CHILD_LEO_ID,
      time: "08:00",
      recurrence: "weekdays",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid("task"),
      title: "Faire ses devoirs",
      childId: CHILD_LEO_ID,
      time: "17:00",
      recurrence: "weekdays",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid("task"),
      title: "Nourrir le chat (photo)",
      childId: CHILD_LEO_ID,
      time: "18:30",
      recurrence: "daily",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid("task"),
      title: "Se laver les mains",
      childId: CHILD_MIA_ID,
      time: "07:45",
      recurrence: "daily",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid("task"),
      title: "Lire 10 minutes",
      childId: CHILD_MIA_ID,
      time: "19:00",
      recurrence: "daily",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid("task"),
      title: "Aider à mettre la table",
      childId: CHILD_MIA_ID,
      time: "19:15",
      recurrence: "once",
      onceDate: once,
      reminderEnabled: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid("task"),
      title: "Préparer les vêtements",
      childId: CHILD_MIA_ID,
      time: "20:00",
      recurrence: "weekdays",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

export function createSeedState(): AppState {
  return {
    profiles: buildDemoProfiles(),
    tasks: buildDemoTasks(),
    completions: [],
    seeded: true,
    currentProfileId: null,
  };
}
