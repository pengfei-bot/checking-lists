import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "../types";
import { createSeedState } from "./seed";

const STORAGE_KEY = "@checking_lists/v2";

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
    return parsed;
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
