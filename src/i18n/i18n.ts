import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  AppLocale,
  LOCALE_STORAGE_KEY,
  resolveDeviceLocale,
  SUPPORTED_LOCALES,
} from "./locales";
import { resources } from "./resources";

let initPromise: Promise<typeof i18n> | null = null;

export function getStoredOrDeviceLocaleSync(): AppLocale {
  const locales = Localization.getLocales?.() ?? [];
  const tag =
    locales[0]?.languageTag ??
    // older expo-localization
    (Localization as { locale?: string }).locale ??
    "fr-FR";
  return resolveDeviceLocale(tag);
}

export async function loadSavedLocale(): Promise<AppLocale> {
  try {
    const saved = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && (SUPPORTED_LOCALES as readonly string[]).includes(saved)) {
      return saved as AppLocale;
    }
  } catch {
    /* ignore */
  }
  return getStoredOrDeviceLocaleSync();
}

export async function persistLocale(locale: AppLocale): Promise<void> {
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export async function changeAppLocale(locale: AppLocale): Promise<void> {
  await persistLocale(locale);
  if (i18n.isInitialized) {
    await i18n.changeLanguage(locale);
  }
}

export function initI18n(lng?: AppLocale): Promise<typeof i18n> {
  if (i18n.isInitialized) {
    if (lng && i18n.language !== lng) {
      return i18n.changeLanguage(lng).then(() => i18n);
    }
    return Promise.resolve(i18n);
  }
  if (initPromise) return initPromise;

  const initial = lng ?? getStoredOrDeviceLocaleSync();
  initPromise = i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: initial,
      fallbackLng: ["fr", "en"],
      compatibilityJSON: "v4",
      interpolation: { escapeValue: false },
      returnNull: false,
    })
    .then(() => i18n);

  return initPromise;
}

export default i18n;
