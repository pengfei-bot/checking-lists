import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Task } from "../types";
import { colors, softTint } from "../theme/colors";
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
  /** e.g. "+5 ⭐" shown as large yellow pill on the right */
  pointsLabel?: string | null;
  onPress?: () => void;
  rightAccessory?: React.ReactNode;
  /** Compact kid-home rows (M3). */
  compact?: boolean;
  /** Optional left emoji icon circle (M2 mockup). */
  iconEmoji?: string | null;
  /** Child color — soft fill + left accent border (M5). */
  accentColor?: string | null;
}

function defaultIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("dent") || t.includes("brush") || t.includes("tooth")) return "🪥";
  if (t.includes("devoir") || t.includes("homework") || t.includes("lire") || t.includes("read")) return "📚";
  if (t.includes("chambre") || t.includes("ranger") || t.includes("room")) return "🧹";
  if (t.includes("poisson") || t.includes("fish") || t.includes("manger")) return "🐟";
  return "✨";
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
  compact,
  iconEmoji,
  accentColor,
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

  const icon = iconEmoji === null ? null : iconEmoji || defaultIcon(task.title);
  const accent = accentColor?.trim() || null;
  const accentStyles = accent
    ? {
        borderLeftWidth: 4,
        borderLeftColor: accent,
        backgroundColor: done ? colors.successSoft : softTint(accent, 0.1),
      }
    : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        done && styles.cardDone,
        accentStyles,
        pressed && { opacity: 0.9 },
      ]}
    >
      {icon ? (
        <View
          style={[
            styles.iconCircle,
            accent && !done ? { backgroundColor: softTint(accent, 0.22) } : null,
            done && styles.iconCircleDone,
          ]}
        >
          <Text style={styles.iconEmoji}>{icon}</Text>
        </View>
      ) : null}
      <View style={styles.left}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.time, compact && styles.timeCompact, done && styles.muted]}>
              🕒 {task.time}
            </Text>
          </View>
          <Text style={[styles.title, compact && styles.titleCompact, done && styles.titleDone]}>
            {task.title}
          </Text>
          <Text style={[styles.meta, compact && styles.metaCompact]}>
            {childName ? `${childName} · ` : ""}
            {recurrenceLabel(task.recurrence, task.intervalWeeks)}
            {task.reminderEnabled ? " · 🔔" : ""}
            {photoPill ? ` ·${photoPill.trim()}` : ""}
            {doneLabel ? ` ${doneLabel}` : ""}
          </Text>
        </View>
      </View>
      {pointsLabel ? (
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsBadgeText}>{pointsLabel}</Text>
        </View>
      ) : null}
      {rightAccessory}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: rewardsUi.cardRadius,
    padding: 12,
    marginBottom: 8,
    borderWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    ...rewardsUi.shadow,
  },
  cardCompact: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  cardDone: {
    backgroundColor: colors.successSoft,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: rewardsUi.peachSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleDone: { backgroundColor: colors.successSoft },
  iconEmoji: { fontSize: 22 },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  time: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  timeCompact: { fontSize: 11 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  title: { fontSize: 16, fontWeight: "800", color: rewardsUi.navy, flexShrink: 1 },
  titleCompact: { fontSize: 15 },
  titleDone: { textDecorationLine: "line-through", color: colors.textMuted },
  pointsBadge: {
    ...rewardsStyles.pointsPill,
  },
  pointsBadgeText: {
    ...rewardsStyles.pointsPillText,
  },
  meta: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  metaCompact: { fontSize: 11 },
  muted: { color: colors.textMuted },
});
