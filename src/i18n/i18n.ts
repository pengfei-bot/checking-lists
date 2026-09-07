import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  AppLocale,
  LOCALE_RESOURCE_ALIASES,
  LOCALE_STORAGE_KEY,
  canonicalizeLocale,
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
  // Keep <html lang> in sync for web font/engine hints.
  const { syncDocumentLang } = await import("../theme/fonts");
  syncDocumentLang(locale);
}

/** All resource keys i18next may look up (canonical + aliases). */
export const I18N_SUPPORTED_LNGS = [
  ...SUPPORTED_LOCALES,
  ...Object.keys(LOCALE_RESOURCE_ALIASES),
] as const;

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
      // Selected locale → French → English for missing/empty keys.
      fallbackLng: ["fr", "en"],
      // Include zh / zh-CN / … aliases. Keep nonExplicitSupportedLngs false:
      // with true, i18next checks language-part "zh" only, rejects zh-Hans when
      // "zh" is absent from supportedLngs, and falls back to fr (UI unchanged).
      supportedLngs: [...I18N_SUPPORTED_LNGS],
      nonExplicitSupportedLngs: false,
      load: "currentOnly",
      compatibilityJSON: "v4",
      interpolation: { escapeValue: false },
      returnNull: false,
      // Incomplete catalogs sometimes ship "" — treat as missing so fr/en fill in.
      returnEmptyString: false,
      parseMissingKeyHandler: () => "",
    })
    .then(async () => {
      const { syncDocumentLang } = await import("../theme/fonts");
      const canonical = canonicalizeLocale(i18n.language) ?? initial;
      if (canonical !== i18n.language) {
        await i18n.changeLanguage(canonical);
      }
      syncDocumentLang(canonical);
      return i18n;
    });

  return initPromise;
}

export default i18n;
