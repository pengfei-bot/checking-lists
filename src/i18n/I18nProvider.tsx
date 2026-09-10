import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { I18nextProvider } from "react-i18next";
import { colors } from "../theme/colors";
import i18n, { initI18n, loadSavedLocale } from "./i18n";
import { AppLocale, canonicalizeLocale } from "./locales";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(i18n.isInitialized);
  const [locale, setLocale] = useState<AppLocale | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await loadSavedLocale();
      if (cancelled) return;
      await initI18n(saved);
      if (cancelled) return;
      setLocale(saved);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onLanguageChanged = (lng: string) => {
      setLocale(canonicalizeLocale(lng) ?? "fr");
    };
    i18n.on("languageChanged", onLanguageChanged);
    return () => {
      i18n.off("languageChanged", onLanguageChanged);
    };
  }, []);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.textMuted }}>…</Text>
      </View>
    );
  }

  // Remount tree when language changes so stack titles / screens refresh.
  const remountKey = locale ?? i18n.language;

  return (
    <I18nextProvider i18n={i18n}>
      <React.Fragment key={remountKey}>{children}</React.Fragment>
    </I18nextProvider>
  );
}
