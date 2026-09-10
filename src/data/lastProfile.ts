import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@famlist/lastProfileId/v1";

export async function loadLastProfileId(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

export async function saveLastProfileId(id: string | null): Promise<void> {
  try {
    if (!id) await AsyncStorage.removeItem(KEY);
    else await AsyncStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}
