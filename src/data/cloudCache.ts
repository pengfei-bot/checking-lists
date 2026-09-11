import AsyncStorage from "@react-native-async-storage/async-storage";
import { Family, ParentAccount } from "../auth/types";
import { AppState } from "../types";

const STATE_PREFIX = "@famlist/cloud_state/v1:";
const FAMILY_PREFIX = "@famlist/family_snapshot/v1:";

export interface CachedFamilyBundle {
  family: Family;
  parent: ParentAccount | null;
  savedAt: string;
}

export interface CachedCloudState {
  state: AppState;
  savedAt: string;
}

function stateKey(familyId: string): string {
  return `${STATE_PREFIX}${familyId}`;
}

function familyKey(familyId: string): string {
  return `${FAMILY_PREFIX}${familyId}`;
}

export async function loadCloudStateCache(familyId: string): Promise<CachedCloudState | null> {
  if (!familyId) return null;
  try {
    const raw = await AsyncStorage.getItem(stateKey(familyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCloudState;
    if (!parsed?.state?.profiles || !Array.isArray(parsed.state.profiles)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCloudStateCache(familyId: string, state: AppState): Promise<void> {
  if (!familyId) return;
  try {
    const payload: CachedCloudState = {
      state: {
        profiles: state.profiles,
        tasks: state.tasks,
        completions: state.completions,
        seeded: state.seeded,
        currentProfileId: state.currentProfileId,
      },
      savedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(stateKey(familyId), JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export async function loadCachedFamily(familyId: string): Promise<CachedFamilyBundle | null> {
  if (!familyId) return null;
  try {
    const raw = await AsyncStorage.getItem(familyKey(familyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedFamilyBundle;
    if (!parsed?.family?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCachedFamily(
  family: Family,
  parent: ParentAccount | null = null
): Promise<void> {
  if (!family?.id) return;
  try {
    const existing = await loadCachedFamily(family.id);
    const payload: CachedFamilyBundle = {
      family,
      parent: parent ?? existing?.parent ?? null,
      savedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(familyKey(family.id), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export async function clearCloudCaches(familyId?: string | null): Promise<void> {
  try {
    if (familyId) {
      await AsyncStorage.multiRemove([stateKey(familyId), familyKey(familyId)]);
      return;
    }
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(STATE_PREFIX) || k.startsWith(FAMILY_PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    /* ignore */
  }
}

/** Minimal family shell so offline session can still open cached checklist data. */
export function familyShellFromMeta(input: {
  familyId: string;
  displayName?: string;
  parentAccountId?: string;
}): Family {
  const now = new Date().toISOString();
  return {
    id: input.familyId,
    name: input.displayName?.trim() || "Famille",
    ownerParentId: input.parentAccountId || "",
    inviteCode: "",
    childProfileIds: [],
    createdAt: now,
    updatedAt: now,
  };
}
