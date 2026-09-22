import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "../types";
import { createSeedState } from "./seed";

const STORAGE_KEY = "@checking_lists/v3";

export async function loadAppState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = createSeedState();
      await saveAppState(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.seeded || !parsed.profiles?.length) {
      const seeded = createSeedState();
      await saveAppState(seeded);
      return seeded;
    }
    return {
      ...parsed,
      rewardSettings: parsed.rewardSettings ?? {
        familyId: "local",
        enabled: true,
        unitLabel: "⭐",
        updatedAt: new Date().toISOString(),
      },
      rewardChildSettings: Array.isArray(parsed.rewardChildSettings)
        ? parsed.rewardChildSettings.map((s) => ({
            ...s,
            enabled: !!(s as { enabled?: boolean }).enabled,
          }))
        : [],
      rewardTasks: Array.isArray(parsed.rewardTasks) ? parsed.rewardTasks : [],
      rewardLedger: Array.isArray(parsed.rewardLedger) ? parsed.rewardLedger : [],
    };
  } catch {
    const seeded = createSeedState();
    await saveAppState(seeded);
    return seeded;
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function resetDemoData(): Promise<AppState> {
  const seeded = createSeedState();
  await saveAppState(seeded);
  return seeded;
}
