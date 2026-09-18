import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/colors";

interface Props {
  visible: boolean;
  syncing?: boolean;
  onRetry?: () => void;
  cachedAt?: string | null;
  pendingMutations?: number;
}

export function OfflineBanner({ visible, syncing, onRetry, cachedAt, pendingMutations = 0 }: Props) {
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

  const pendingLabel =
    pendingMutations > 0
      ? t("offline.pendingMutations", { count: pendingMutations })
      : null;

  const tone = syncing ? "syncing" : pendingMutations > 0 ? "pending" : "offline";

  return (
    <View
      style={[
        styles.wrap,
        tone === "syncing" ? styles.syncing : tone === "pending" ? styles.pendingWrap : styles.offline,
      ]}
      accessibilityRole="summary"
      accessibilityLabel={pendingLabel ? `${t("offline.banner")}. ${pendingLabel}` : undefined}
    >
      <View style={styles.row}>
        {syncing ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        <View style={styles.textCol}>
          <Text style={styles.text}>
            {syncing
              ? t("offline.bannerSyncing")
              : timeLabel
                ? t("offline.bannerCached", { time: timeLabel })
                : t("offline.banner")}
          </Text>
          {pendingLabel ? <Text style={styles.pending}>{pendingLabel}</Text> : null}
        </View>
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
    borderBottomWidth: 1,
  },
  offline: { backgroundColor: "#FFF4E5", borderBottomColor: "#FFD8A8" },
  pendingWrap: { backgroundColor: "#FFE8CC", borderBottomColor: "#FFB84D" },
  syncing: { backgroundColor: colors.primarySoft, borderBottomColor: "#C9D4FF" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  textCol: { flexShrink: 1, flex: 1, gap: 2 },
  text: { color: colors.text, fontWeight: "600", fontSize: 13 },
  pending: { color: "#9C5B00", fontWeight: "800", fontSize: 13 },
  retry: { color: colors.primary, fontWeight: "800", fontSize: 13 },
});
