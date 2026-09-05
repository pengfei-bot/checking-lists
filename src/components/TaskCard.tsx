import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Task } from "../types";
import { colors } from "../theme/colors";
import { recurrenceLabel } from "../utils/recurrence";

interface Props {
  task: Task;
  done?: boolean;
  childName?: string;
  onPress?: () => void;
  rightAccessory?: React.ReactNode;
}

export function TaskCard({ task, done, childName, onPress, rightAccessory }: Props) {
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
          <Text style={[styles.title, done && styles.titleDone]}>{task.title}</Text>
          <Text style={styles.meta}>
            {childName ? `${childName} · ` : ""}
            {recurrenceLabel(task.recurrence)}
            {task.reminderEnabled ? " · 🔔" : ""}
            {done ? " · ✅ Fait" : ""}
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
    borderRadius: 16,
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
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  titleDone: { textDecorationLine: "line-through", color: colors.textMuted },
  meta: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  muted: { color: colors.textMuted },
});
