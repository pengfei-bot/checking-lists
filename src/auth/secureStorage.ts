/**
 * Credential / auth blob storage.
 *
 * - Native (iOS/Android): expo-secure-store (Keychain / Keystore)
 * - Web: AsyncStorage fallback — **DEV / PROTOTYPE ONLY**
 *   Do not ship production web auth on AsyncStorage; move secrets server-side
 *   (Supabase Auth / Firebase Auth) before App Store / production web.
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

let SecureStore: typeof import("expo-secure-store") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SecureStore = require("expo-secure-store");
} catch {
  SecureStore = null;
}

const useSecureStore = Platform.OS !== "web" && SecureStore != null;

export function isUsingSecureStore(): boolean {
  return useSecureStore;
}

export async function secureGet(key: string): Promise<string | null> {
  if (useSecureStore && SecureStore) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return AsyncStorage.getItem(key);
    }
  }
  return AsyncStorage.getItem(key);
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (useSecureStore && SecureStore) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      // fall through
    }
  }
  await AsyncStorage.setItem(key, value);
}

export async function secureDelete(key: string): Promise<void> {
  if (useSecureStore && SecureStore) {
    try {
      await SecureStore.deleteItemAsync(key);
      return;
    } catch {
      // fall through
    }
  }
  await AsyncStorage.removeItem(key);
}
