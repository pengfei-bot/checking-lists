import {
  RewardChildSettings,
  RewardLedgerEntry,
  RewardSettings,
  RewardTask,
  RewardUnitKind,
  Task,
  TaskCompletion,
} from "../types";

export function emptyRewardsState(familyId = "local"): {
  rewardSettings: RewardSettings;
  rewardChildSettings: RewardChildSettings[];
  rewardTasks: RewardTask[];
  rewardLedger: RewardLedgerEntry[];
} {
  return {
    rewardSettings: {
      familyId,
      enabled: true,
      unitLabel: "⭐",
      updatedAt: new Date().toISOString(),
    },
    rewardChildSettings: [],
    rewardTasks: [],
    rewardLedger: [],
  };
}

export function balanceForChild(
  ledger: RewardLedgerEntry[],
  childProfileId: string
): number {
  return ledger
    .filter((e) => e.childProfileId === childProfileId)
    .reduce((sum, e) => sum + e.amount, 0);
}

export function pointsForTask(
  rewardTasks: RewardTask[],
  taskId: string
): number | null {
  const row = rewardTasks.find((r) => r.taskId === taskId && r.active);
  return row && row.points > 0 ? row.points : null;
}

export function ledgerHasEarnForCompletion(
  ledger: RewardLedgerEntry[],
  completionId: string
): RewardLedgerEntry | undefined {
  return ledger.find(
    (e) => e.kind === "earn" && e.completionId === completionId
  );
}

export function ledgerForChild(
  ledger: RewardLedgerEntry[],
  childProfileId: string
): RewardLedgerEntry[] {
  return ledger
    .filter((e) => e.childProfileId === childProfileId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function unitKindForChild(
  settings: RewardChildSettings[],
  childProfileId: string
): RewardUnitKind {
  const row = settings.find((s) => s.childProfileId === childProfileId);
  return row?.unitKind === "money" ? "money" : "points";
}

export function childSettingsFor(
  settings: RewardChildSettings[],
  childProfileId: string
): RewardChildSettings | undefined {
  return settings.find((s) => s.childProfileId === childProfileId);
}

/**
 * Per-child gate (M1). Family reward_settings.enabled is an optional master:
 * if a family row exists and is explicitly disabled, everything is off.
 * Missing child row ⇒ not enabled.
 */
export function isRewardsActiveForChild(
  childProfileId: string,
  childSettings: RewardChildSettings[],
  familySettings: RewardSettings | null | undefined
): boolean {
  if (familySettings && familySettings.enabled === false) return false;
  const row = childSettings.find((s) => s.childProfileId === childProfileId);
  return !!row?.enabled;
}

/** Short display unit for balances / CTAs (i18n keys resolved by caller). */
export function unitShortKey(kind: RewardUnitKind): "rewards.unitPointsShort" | "rewards.unitMoneyShort" {
  return kind === "money" ? "rewards.unitMoneyShort" : "rewards.unitPointsShort";
}

export interface PendingEarnItem {
  completionId: string;
  taskId: string;
  childId: string;
  points: number;
  taskTitle: string;
  completedAt: string;
  date: string;
}

/**
 * Pending = completions where rewards are active for that child, the task has
 * active reward_tasks.points, and no ledger earn row exists yet for completion_id.
 */
export function listPendingEarns(
  childSettings: RewardChildSettings[],
  familySettings: RewardSettings | null | undefined,
  completions: TaskCompletion[],
  tasks: Task[],
  rewardTasks: RewardTask[],
  ledger: RewardLedgerEntry[]
): PendingEarnItem[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const earned = new Set(
    ledger
      .filter((e) => e.kind === "earn" && e.completionId)
      .map((e) => e.completionId as string)
  );
  const out: PendingEarnItem[] = [];
  for (const c of completions) {
    if (!isRewardsActiveForChild(c.childId, childSettings, familySettings)) continue;
    if (earned.has(c.id)) continue;
    const pts = pointsForTask(rewardTasks, c.taskId);
    if (pts == null) continue;
    const task = taskById.get(c.taskId);
    out.push({
      completionId: c.id,
      taskId: c.taskId,
      childId: c.childId,
      points: pts,
      taskTitle: task?.title ?? "—",
      completedAt: c.completedAt,
      date: c.date,
    });
  }
  out.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return out;
}
