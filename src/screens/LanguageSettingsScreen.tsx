import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { PrimaryButton } from "../components/PrimaryButton";
import {
  ASIA_LOCALES,
  AppLocale,
  EUROPE_LOCALES,
  LOCALE_LABELS,
  changeAppLocale,
  formatLocaleLabel,
} from "../i18n";
import { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { notifyUser } from "../utils/feedback";

type Props = NativeStackScreenProps<RootStackParamList, "LanguageSettings">;

export function LanguageSettingsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const current = (i18n.language as AppLocale) || "fr";

  const europe = useMemo(() => [...EUROPE_LOCALES], []);
  const asia = useMemo(() => [...ASIA_LOCALES], []);

  const onSelect = (locale: AppLocale) => {
    if (locale === current || busy) return;
    void (async () => {
      setBusy(true);
      try {
        await changeAppLocale(locale);
        notifyUser(t("language.saved"), formatLocaleLabel(locale));
      } finally {
        setBusy(false);
      }
    })();
  };

  const renderLocale = (code: AppLocale) => {
    const active = current === code || current.startsWith(code);
    return (
      <Pressable
        key={code}
        onPress={() => onSelect(code)}
        style={[styles.row, active && styles.rowActive]}
        disabled={busy}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, active && styles.rowTitleActive]}>
            {formatLocaleLabel(code)}
          </Text>
          <Text style={styles.rowCode}>{code}</Text>
        </View>
        {active ? <Text style={styles.check}>✓</Text> : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t("language.title")}</Text>
        <Text style={styles.subtitle}>{t("language.subtitle")}</Text>
        <Text style={styles.current}>
          {t("language.current", {
            name: formatLocaleLabel(
              (current in LOCALE_LABELS ? current : "fr") as AppLocale
            ),
          })}
        </Text>

        <Text style={styles.section}>{t("language.europe")}</Text>
        {europe.map(renderLocale)}

        <Text style={styles.section}>{t("language.asia")}</Text>
        {asia.map(renderLocale)}

        <PrimaryButton
          label={t("common.back")}
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  subtitle: {
    color: colors.textMuted,
    marginTop: 8,
    lineHeight: 20,
    marginBottom: 8,
  },
  current: {
    marginTop: 4,
    marginBottom: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  section: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  rowTitle: { fontWeight: "700", color: colors.text, fontSize: 16 },
  rowTitleActive: { color: colors.primary },
  rowCode: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  check: { fontSize: 18, fontWeight: "800", color: colors.primary },
});
