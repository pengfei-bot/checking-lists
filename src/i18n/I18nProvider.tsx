import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { I18nextProvider } from "react-i18next";
import { colors } from "../theme/colors";
import i18n, { initI18n, loadSavedLocale } from "./i18n";
import { AppLocale } from "./locales";

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

  const value = useMemo(() => ({ locale }), [locale]);
  void value;

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

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
