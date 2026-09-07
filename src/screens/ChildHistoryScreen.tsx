import React, { useMemo } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";
import { PrimaryButton } from "../components/PrimaryButton";
import { parseISODate } from "../utils/dates";
import { TaskCompletion } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "ChildHistory">;

function formatCompletionTime(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatShortFrenchDate(isoDate: string): string {
  const date = parseISODate(isoDate);
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ChildHistoryScreen({ navigation }: Props) {
  const { currentProfile, state, getTask, setCurrentProfileId } = useApp();
  const childId = currentProfile?.role === "child" ? currentProfile.id : null;

  const items = useMemo(() => {
    if (!childId) return [] as TaskCompletion[];
    const list = state.completions.filter((c) => c.childId === childId);
    return [...list].sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return b.completedAt.localeCompare(a.completedAt);
    });
  }, [state.completions, childId]);

  if (!currentProfile || currentProfile.role !== "child") {
    return (
      <View style={styles.center}>
        <Text>Profil enfant requis.</Text>
        <PrimaryButton
          label="Changer de profil"
          onPress={() => {
            setCurrentProfileId(null);
            navigation.replace("ProfilePicker");
          }}
          style={{ marginTop: 12 }}
        />
      </View>
    );
  }

  const renderRow = (c: TaskCompletion) => {
    const task = getTask(c.taskId);
    const title = task?.title ?? "Tâche";
    const time = formatCompletionTime(c.completedAt);
    return (
      <View key={c.id} style={styles.row}>
        {c.photoUri ? (
          <Image source={{ uri: c.photoUri }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbEmoji}>✅</Text>
          </View>
        )}
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.rowMeta}>
            {formatShortFrenchDate(c.date)}
            {time ? ` · ${time}` : ""}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.hero, { backgroundColor: currentProfile.color + "22" }]}>
          <Text style={styles.heroEmoji}>{currentProfile.emoji}</Text>
          <Text style={styles.heroTitle}>Historique</Text>
          <Text style={styles.heroSub}>
            {currentProfile.name} · {items.length} réalisation
            {items.length === 1 ? "" : "s"}
          </Text>
        </View>

        {items.length === 0 ? (
          <Text style={styles.empty}>Pas encore de tâches réalisées.</Text>
        ) : (
          items.map(renderRow)
        )}

        <PrimaryButton
          label="Retour"
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.kidBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: { padding: 16, paddingBottom: 40 },
  hero: { borderRadius: 20, padding: 18, marginBottom: 16 },
  heroEmoji: { fontSize: 36 },
  heroTitle: { fontSize: 24, fontWeight: "800", color: colors.text, marginTop: 4 },
  heroSub: { color: colors.textMuted, marginTop: 4, fontWeight: "600" },
  empty: {
    textAlign: "center",
    color: colors.textMuted,
    marginVertical: 32,
    fontSize: 16,
    lineHeight: 22,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.successSoft,
  },
  thumbEmoji: { fontSize: 22 },
  rowBody: { flex: 1 },
  rowTitle: { fontWeight: "800", fontSize: 15, color: colors.text },
  rowMeta: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 13,
    textTransform: "capitalize",
  },
});
