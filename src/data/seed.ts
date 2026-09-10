import { AppState, Profile, Task, TaskCompletion } from "../types";
import { addDaysISO, todayISO } from "../utils/dates";
import { isTaskForDate } from "../utils/recurrence";

/** Soft orange placeholder used for seeded photo-proof history. */
const DEMO_PHOTO_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAA4CAIAAAAn5KxJAAAARElEQVR42u3OQQkAAAgEsOufyQh20ocphMECLNP1QkRFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRc8CbP33g1mcWGcAAAAASUVORK5CYII=";

export const PARENT_ID = "profile_parent_demo";
export const CHILD_LEO_ID = "profile_child_leo";
export const CHILD_MIA_ID = "profile_child_mia";
export const CHILD_NOA_ID = "profile_child_noa";
export const CHILD_SAM_ID = "profile_child_sam";

/** Stable demo task IDs so history seed stays consistent. */
export const DEMO_TASK_IDS = {
  leoBrush: "task_leo_brush",
  leoBag: "task_leo_bag",
  leoHomework: "task_leo_homework",
  leoCat: "task_leo_cat",
  miaHands: "task_mia_hands",
  miaRead: "task_mia_read",
  miaTable: "task_mia_table",
  miaClothes: "task_mia_clothes",
  noaWater: "task_noa_water",
  noaToys: "task_noa_toys",
  samShoes: "task_sam_shoes",
  samBed: "task_sam_bed",
  samHomework: "task_sam_homework",
} as const;

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
    {
      id: CHILD_NOA_ID,
      name: "Noa",
      role: "child",
      emoji: "🦊",
      color: "#81C784",
    },
    {
      id: CHILD_SAM_ID,
      name: "Sam",
      role: "child",
      emoji: "🐻",
      color: "#BA68C8",
    },
  ];
}

export function buildDemoTasks(now = new Date()): Task[] {
  const createdAt = now.toISOString();
  const once = todayISO(now);
  return [
    {
      id: DEMO_TASK_IDS.leoBrush,
      title: "Se brosser les dents",
      childId: CHILD_LEO_ID,
      time: "07:30",
      recurrence: "daily",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: DEMO_TASK_IDS.leoBag,
      title: "Ranger son cartable",
      childId: CHILD_LEO_ID,
      time: "08:00",
      recurrence: "weekdays",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: DEMO_TASK_IDS.leoHomework,
      title: "Faire ses devoirs",
      childId: CHILD_LEO_ID,
      time: "17:00",
      recurrence: "weekdays",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: DEMO_TASK_IDS.leoCat,
      title: "Nourrir le chat (photo)",
      childId: CHILD_LEO_ID,
      time: "18:30",
      recurrence: "daily",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: DEMO_TASK_IDS.miaHands,
      title: "Se laver les mains",
      childId: CHILD_MIA_ID,
      time: "07:45",
      recurrence: "daily",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: DEMO_TASK_IDS.miaRead,
      title: "Lire 10 minutes",
      childId: CHILD_MIA_ID,
      time: "19:00",
      recurrence: "daily",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: DEMO_TASK_IDS.miaTable,
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
      id: DEMO_TASK_IDS.miaClothes,
      title: "Préparer les vêtements",
      childId: CHILD_MIA_ID,
      time: "20:00",
      recurrence: "weekdays",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: DEMO_TASK_IDS.noaWater,
      title: "Boire un grand verre d'eau",
      childId: CHILD_NOA_ID,
      time: "08:15",
      recurrence: "daily",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: DEMO_TASK_IDS.noaToys,
      title: "Ranger les jouets",
      childId: CHILD_NOA_ID,
      time: "18:00",
      recurrence: "daily",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: DEMO_TASK_IDS.samShoes,
      title: "Préparer ses chaussures",
      childId: CHILD_SAM_ID,
      time: "07:50",
      recurrence: "weekdays",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: DEMO_TASK_IDS.samBed,
      title: "Faire son lit",
      childId: CHILD_SAM_ID,
      time: "08:10",
      recurrence: "daily",
      reminderEnabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: DEMO_TASK_IDS.samHomework,
      title: "Lire une page",
      childId: CHILD_SAM_ID,
      time: "19:30",
      recurrence: "daily",
      reminderEnabled: false,
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

/**
 * Build demo completion history for the last `daysBack` days (excluding today),
 * so the parent monthly calendar shows meaningful colors.
 * Pattern per day offset (from yesterday going back):
 * - all done / partial / missed / partial cycling
 */
export function buildDemoCompletions(
  tasks: Task[],
  now = new Date(),
  daysBack = 21
): TaskCompletion[] {
  const today = todayISO(now);
  const completions: TaskCompletion[] = [];
  let seq = 0;

  for (let offset = 1; offset <= daysBack; offset++) {
    const date = addDaysISO(today, -offset);
    const dayDate = (() => {
      const [y, m, d] = date.split("-").map(Number);
      return new Date(y, m - 1, d);
    })();
    const dayTasks = tasks.filter((t) => isTaskForDate(t, dayDate));
    if (dayTasks.length === 0) continue;

    // Cycle: 0=all, 1=partial(~half), 2=missed(none), 3=almost all
    const pattern = offset % 4;
    let toComplete: Task[];
    if (pattern === 0) {
      toComplete = dayTasks;
    } else if (pattern === 1) {
      toComplete = dayTasks.slice(0, Math.max(1, Math.floor(dayTasks.length / 2)));
    } else if (pattern === 2) {
      toComplete = [];
    } else {
      toComplete = dayTasks.slice(0, Math.max(1, dayTasks.length - 1));
    }

    for (const task of toComplete) {
      seq += 1;
      const withPhoto =
        task.id === DEMO_TASK_IDS.leoCat ||
        task.title.toLowerCase().includes("photo");
      completions.push({
        id: `done_seed_${seq}`,
        taskId: task.id,
        childId: task.childId,
        date,
        completedAt: `${date}T${task.time}:00.000Z`,
        photoUri: withPhoto ? DEMO_PHOTO_URI : undefined,
      });
    }
  }

  return completions;
}

export function createSeedState(now = new Date()): AppState {
  const tasks = buildDemoTasks(now);
  return {
    profiles: buildDemoProfiles(),
    tasks,
    completions: buildDemoCompletions(tasks, now),
    seeded: true,
    currentProfileId: null,
  };
}
