import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { Recurrence, Task } from "../types";

const QUEUE_PREFIX = "@famlist/mutation_queue/v1:";

export type QueuedUpsertTaskInput = Omit<Task, "id" | "createdAt" | "updatedAt"> & {
  id: string;
};

export type QueuedMutation =
  | {
      id: string;
      type: "markDone";
      familyId: string;
      taskId: string;
      childId: string;
      date: string;
      completionId: string;
      /** Local URI to upload on flush; omit if no photo / already durable. */
      localPhotoUri?: string;
      createdAt: string;
    }
  | {
      id: string;
      type: "unmarkDone";
      familyId: string;
      taskId: string;
      date: string;
      createdAt: string;
    }
  | {
      id: string;
      type: "upsertTask";
      familyId: string;
      input: QueuedUpsertTaskInput;
      createdAt: string;
    }
  | {
      id: string;
      type: "deleteTask";
      familyId: string;
      taskId: string;
      createdAt: string;
    }
  | {
      id: string;
      type: "clearCompletionPhoto";
      familyId: string;
      completionId: string;
      createdAt: string;
    };

function queueKey(familyId: string): string {
  return `${QUEUE_PREFIX}${familyId}`;
}

function newQueueId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return Crypto.randomUUID();
}

export async function loadMutationQueue(familyId: string): Promise<QueuedMutation[]> {
  if (!familyId) return [];
  try {
    const raw = await AsyncStorage.getItem(queueKey(familyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedMutation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveMutationQueue(familyId: string, items: QueuedMutation[]): Promise<void> {
  if (!familyId) return;
  try {
    if (!items.length) {
      await AsyncStorage.removeItem(queueKey(familyId));
      return;
    }
    await AsyncStorage.setItem(queueKey(familyId), JSON.stringify(items));
  } catch {
    /* ignore quota */
  }
}

/**
 * Coalesce conflicting ops so flush stays sane:
 * - markDone then unmarkDone (same task/date) → drop both
 * - unmarkDone then markDone → keep markDone only
 * - multiple upsertTask same id → keep latest
 * - deleteTask drops prior upserts for that id; later upsert replaces delete
 * - clearCompletionPhoto after unmark for same completion is fine (no-op on flush)
 */
export function coalesceQueue(items: QueuedMutation[]): QueuedMutation[] {
  const out: QueuedMutation[] = [];

  for (const item of items) {
    if (item.type === "markDone") {
      const idx = out.findIndex(
        (q) =>
          (q.type === "markDone" || q.type === "unmarkDone") &&
          q.taskId === item.taskId &&
          q.date === item.date
      );
      if (idx >= 0) out.splice(idx, 1);
      out.push(item);
      continue;
    }

    if (item.type === "unmarkDone") {
      const idx = out.findIndex(
        (q) =>
          (q.type === "markDone" || q.type === "unmarkDone") &&
          q.taskId === item.taskId &&
          q.date === item.date
      );
      if (idx >= 0) {
        const prev = out[idx];
        out.splice(idx, 1);
        // mark then unmark → cancel both
        if (prev.type === "markDone") continue;
      }
      out.push(item);
      continue;
    }

    if (item.type === "upsertTask") {
      // Drop prior upsert/delete for same task id
      for (let i = out.length - 1; i >= 0; i--) {
        const q = out[i];
        if (q.type === "upsertTask" && q.input.id === item.input.id) out.splice(i, 1);
        if (q.type === "deleteTask" && q.taskId === item.input.id) out.splice(i, 1);
      }
      out.push(item);
      continue;
    }

    if (item.type === "deleteTask") {
      for (let i = out.length - 1; i >= 0; i--) {
        const q = out[i];
        if (q.type === "upsertTask" && q.input.id === item.taskId) out.splice(i, 1);
        if (q.type === "deleteTask" && q.taskId === item.taskId) out.splice(i, 1);
        if (
          (q.type === "markDone" || q.type === "unmarkDone") &&
          q.taskId === item.taskId
        ) {
          out.splice(i, 1);
        }
      }
      out.push(item);
      continue;
    }

    if (item.type === "clearCompletionPhoto") {
      let absorbedIntoPendingMark = false;
      for (let i = out.length - 1; i >= 0; i--) {
        const q = out[i];
        if (q.type === "clearCompletionPhoto" && q.completionId === item.completionId) {
          out.splice(i, 1);
          continue;
        }
        if (q.type === "markDone" && q.completionId === item.completionId) {
          out[i] = { ...q, localPhotoUri: undefined };
          absorbedIntoPendingMark = true;
        }
      }
      if (!absorbedIntoPendingMark) out.push(item);
      continue;
    }

    out.push(item);
  }

  return out;
}

export async function enqueueMutation(
  familyId: string,
  mutation:
    | Omit<Extract<QueuedMutation, { type: "markDone" }>, "id" | "createdAt" | "familyId">
    | Omit<Extract<QueuedMutation, { type: "unmarkDone" }>, "id" | "createdAt" | "familyId">
    | Omit<Extract<QueuedMutation, { type: "upsertTask" }>, "id" | "createdAt" | "familyId">
    | Omit<Extract<QueuedMutation, { type: "deleteTask" }>, "id" | "createdAt" | "familyId">
    | Omit<Extract<QueuedMutation, { type: "clearCompletionPhoto" }>, "id" | "createdAt" | "familyId">
): Promise<QueuedMutation[]> {
  const prev = await loadMutationQueue(familyId);
  const nextItem = {
    ...mutation,
    id: newQueueId(),
    familyId,
    createdAt: new Date().toISOString(),
  } as QueuedMutation;
  const next = coalesceQueue([...prev, nextItem]);
  await saveMutationQueue(familyId, next);
  return next;
}

export async function replaceMutationQueue(
  familyId: string,
  items: QueuedMutation[]
): Promise<void> {
  await saveMutationQueue(familyId, coalesceQueue(items));
}

export async function clearMutationQueue(familyId?: string | null): Promise<void> {
  try {
    if (familyId) {
      await AsyncStorage.removeItem(queueKey(familyId));
      return;
    }
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(QUEUE_PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    /* ignore */
  }
}

export function taskInputForQueue(
  input: Omit<Task, "id" | "createdAt" | "updatedAt"> & { id: string }
): QueuedUpsertTaskInput {
  return {
    id: input.id,
    title: input.title,
    childId: input.childId,
    time: input.time,
    recurrence: input.recurrence as Recurrence,
    reminderEnabled: input.reminderEnabled,
    onceDate: input.onceDate,
    startDate: input.startDate,
    endDate: input.endDate,
    intervalWeeks: input.intervalWeeks,
  };
}
