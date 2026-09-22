import {
  cloudClearCompletionPhoto,
  cloudDeleteTask,
  cloudMarkDone,
  cloudUnmarkDone,
  cloudUpsertTask,
} from "./cloudSync";
import {
  loadMutationQueue,
  QueuedMutation,
  replaceMutationQueue,
} from "./mutationQueue";

export type FlushResult = {
  flushed: number;
  remaining: number;
  error?: string;
};

/**
 * Apply queued offline mutations in order. Stops on first failure so the
 * failed op stays at the head of the queue for retry.
 */
export async function flushMutationQueue(familyId: string): Promise<FlushResult> {
  if (!familyId) return { flushed: 0, remaining: 0 };
  let queue = await loadMutationQueue(familyId);
  if (!queue.length) return { flushed: 0, remaining: 0 };

  let flushed = 0;
  while (queue.length) {
    const item = queue[0];
    try {
      await applyOne(item);
      queue = queue.slice(1);
      await replaceMutationQueue(familyId, queue);
      flushed += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync queue failed.";
      return { flushed, remaining: queue.length, error: msg };
    }
  }
  return { flushed, remaining: 0 };
}

async function applyOne(item: QueuedMutation): Promise<void> {
  switch (item.type) {
    case "markDone":
      await cloudMarkDone(
        item.familyId,
        item.taskId,
        item.childId,
        item.date,
        item.localPhotoUri,
        { completionId: item.completionId }
      );
      return;
    case "unmarkDone":
      await cloudUnmarkDone(item.taskId, item.date);
      return;
    case "upsertTask":
      await cloudUpsertTask(item.familyId, item.input);
      return;
    case "deleteTask":
      await cloudDeleteTask(item.taskId);
      return;
    case "clearCompletionPhoto":
      await cloudClearCompletionPhoto(item.completionId);
      return;
    default: {
      const _exhaustive: never = item;
      void _exhaustive;
    }
  }
}
