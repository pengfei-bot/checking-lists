import { RewardLedgerEntry, RewardSettings, RewardTask } from "../types";

export function emptyRewardsState(familyId = "local"): {
  rewardSettings: RewardSettings;
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
