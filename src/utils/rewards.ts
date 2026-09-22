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

/** Note written on adjust rows that reverse a credited earn after uncomplete. */
export const VOID_UNCOMPLETE_NOTE = "void_uncomplete";

export function ledgerHasVoidForCompletion(
  ledger: RewardLedgerEntry[],
  completionId: string
): RewardLedgerEntry | undefined {
  return ledger.find(
    (e) =>
      e.kind === "adjust" &&
      e.completionId === completionId &&
      e.note === VOID_UNCOMPLETE_NOTE
  );
}

/**
 * Active (not voided) earn for a completion. Used so a voided earn does not
 * block re-earn after a rare same-id race, and for optimistic credit checks.
 */
export function ledgerHasActiveEarnForCompletion(
  ledger: RewardLedgerEntry[],
  completionId: string
): RewardLedgerEntry | undefined {
  const earn = ledgerHasEarnForCompletion(ledger, completionId);
  if (!earn) return undefined;
  if (ledgerHasVoidForCompletion(ledger, completionId)) return undefined;
  return earn;
}

/**
 * Build a local optimistic void adjust for an uncomplete, or null if there is
 * nothing to reverse (already voided / no earn).
 */
export function buildVoidAdjustForCompletion(
  ledger: RewardLedgerEntry[],
  completion: Pick<TaskCompletion, "id" | "taskId" | "childId">,
  familyId: string,
  id: string,
  createdAt = new Date().toISOString()
): RewardLedgerEntry | null {
  const earn = ledgerHasActiveEarnForCompletion(ledger, completion.id);
  if (!earn) return null;
  return {
    id,
    familyId,
    childProfileId: completion.childId,
    amount: -earn.amount,
    kind: "adjust",
    taskId: completion.taskId,
    completionId: completion.id,
    note: VOID_UNCOMPLETE_NOTE,
    createdAt,
  };
}

/**
 * Local optimistic earn on task complete (mirrors DB credit trigger).
 * Returns null when rewards inactive, no points, or already credited.
 */
export function buildEarnForCompletion(
  ledger: RewardLedgerEntry[],
  rewardTasks: RewardTask[],
  childSettings: RewardChildSettings[],
  familySettings: RewardSettings | null | undefined,
  completion: Pick<TaskCompletion, "id" | "taskId" | "childId">,
  familyId: string,
  id: string,
  createdAt = new Date().toISOString()
): RewardLedgerEntry | null {
  if (!isRewardsActiveForChild(completion.childId, childSettings, familySettings)) {
    return null;
  }
  const pts = pointsForTask(rewardTasks, completion.taskId);
  if (pts == null) return null;
  if (ledgerHasActiveEarnForCompletion(ledger, completion.id)) return null;
  return {
    id,
    familyId,
    childProfileId: completion.childId,
    amount: pts,
    kind: "earn",
    taskId: completion.taskId,
    completionId: completion.id,
    note: "auto_complete",
    createdAt,
  };
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
 * Missing child row ⇒ not enabled (do not soft-default). Prefer
 * ensureMissingChildRewardSettings / SQL backfill to create enabled:true rows
 * so UX stays single-path.
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
