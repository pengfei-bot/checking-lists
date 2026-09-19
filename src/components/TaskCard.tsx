import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Task } from "../types";
import { colors } from "../theme/colors";
import { rewardsStyles, rewardsUi } from "../theme/rewardsUi";
import { recurrenceLabel } from "../utils/recurrence";
import { formatCompletionTime } from "../utils/dates";

interface Props {
  task: Task;
  done?: boolean;
  completedAt?: string;
  /** Proof photo already received (Storage URL / local) */
  hasPhoto?: boolean;
  childName?: string;
  /** e.g. "+5 ⭐" shown next to the title when rewards are active for the child */
  pointsLabel?: string | null;
  onPress?: () => void;
  rightAccessory?: React.ReactNode;
}

export function TaskCard({
  task,
  done,
  completedAt,
  hasPhoto,
  childName,
  pointsLabel,
  onPress,
  rightAccessory,
}: Props) {
  const { t, i18n } = useTranslation();
  const doneTime = done && completedAt ? formatCompletionTime(completedAt, i18n.language) : null;
  const doneLabel = done
    ? doneTime
      ? `· ✅ ${t("common.doneAt", { time: doneTime })}`
      : `· ✅ ${t("common.done")}`
    : "";

  const photoPill = task.photoRequired
    ? hasPhoto
      ? " ✓📷"
      : " 📷"
    : "";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        done && styles.cardDone,
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.left}>
        <Text style={[styles.time, done && styles.muted]}>{task.time}</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, done && styles.titleDone]}>{task.title}</Text>
            {pointsLabel ? (
              <View style={styles.pointsBadge}>
                <Text style={styles.pointsBadgeText}>{pointsLabel}</Text>
              </View>
            ) : null}
            {task.photoRequired ? (
              <Text
                style={styles.photoPill}
                accessibilityLabel={
                  hasPhoto ? t("photoRequired.receivedA11y") : t("photoRequired.requiredA11y")
                }
              >
                {hasPhoto ? "✓📷" : "📷"}
              </Text>
            ) : null}
          </View>
          <Text style={styles.meta}>
            {childName ? `${childName} · ` : ""}
            {recurrenceLabel(task.recurrence, task.intervalWeeks)}
            {task.reminderEnabled ? " · 🔔" : ""}
            {photoPill ? ` ·${photoPill.trim()}` : ""}
            {doneLabel ? ` ${doneLabel}` : ""}
          </Text>
        </View>
      </View>
      {rightAccessory}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: rewardsUi.cardRadius,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardDone: {
    backgroundColor: colors.successSoft,
    borderColor: "#B7E4C7",
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  time: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
    minWidth: 48,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  title: { fontSize: 16, fontWeight: "700", color: colors.text, flexShrink: 1 },
  titleDone: { textDecorationLine: "line-through", color: colors.textMuted },
  pointsBadge: {
    ...rewardsStyles.pointsPill,
  },
  pointsBadgeText: {
    ...rewardsStyles.pointsPillText,
  },
  photoPill: { fontSize: 14 },
  meta: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  muted: { color: colors.textMuted },
});
