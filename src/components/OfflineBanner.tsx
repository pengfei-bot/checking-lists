import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/colors";

interface Props {
  visible: boolean;
  syncing?: boolean;
  onRetry?: () => void;
  cachedAt?: string | null;
}

export function OfflineBanner({ visible, syncing, onRetry, cachedAt }: Props) {
  const { t, i18n } = useTranslation();
  if (!visible && !syncing) return null;

  const timeLabel =
    cachedAt &&
    (() => {
      try {
        return new Date(cachedAt).toLocaleString(i18n.language, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return null;
      }
    })();

  return (
    <View style={[styles.wrap, syncing ? styles.syncing : styles.offline]} accessibilityRole="summary">
      <View style={styles.row}>
        {syncing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        <Text style={styles.text}>
          {syncing
            ? t("offline.bannerSyncing")
            : timeLabel
              ? t("offline.bannerCached", { time: timeLabel })
              : t("offline.banner")}
        </Text>
      </View>
      {!syncing && onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
          <Text style={styles.retry}>{t("offline.retry")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  offline: { backgroundColor: "#FFF4E5" },
  syncing: { backgroundColor: colors.primarySoft },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  text: { color: colors.text, fontWeight: "600", fontSize: 13, flexShrink: 1 },
  retry: { color: colors.primary, fontWeight: "800", fontSize: 13 },
});
