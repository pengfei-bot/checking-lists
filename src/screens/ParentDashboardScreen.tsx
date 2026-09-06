import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";
import { TaskCard } from "../components/TaskCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { formatFrenchDate, todayISO } from "../utils/dates";
import { isTaskForDate } from "../utils/recurrence";
import { addTodayTasksToCalendar, calendarSupported } from "../services/calendar";
import { ensureNotificationPermissions, notificationsSupported } from "../services/notifications";

type Props = NativeStackScreenProps<RootStackParamList, "ParentDashboard">;

export function ParentDashboardScreen({ navigation }: Props) {
  const {
    currentProfile,
    childrenProfiles,
    state,
    completionFor,
    setCurrentProfileId,
    refreshReminders,
  } = useApp();
  const { isAuthenticated, family } = useAuth();
  const [filterChildId, setFilterChildId] = useState<string | "all">("all");

  if (!currentProfile || currentProfile.role !== "parent") {
    return (
      <View style={styles.center}>
        <Text>Profil parent requis.</Text>
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

  const todayTasks = useMemo(() => {
    return state.tasks
      .filter((t) => isTaskForDate(t))
      .filter((t) => filterChildId === "all" || t.childId === filterChildId)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [state.tasks, filterChildId]);

  const stats = childrenProfiles.map((child) => {
    const tasks = state.tasks.filter((t) => t.childId === child.id && isTaskForDate(t));
    const done = tasks.filter((t) => completionFor(t.id)).length;
    return { child, total: tasks.length, done };
  });

  const onCalendar = async () => {
    const result = await addTodayTasksToCalendar(
      state.tasks,
      state.profiles,
      filterChildId === "all" ? undefined : filterChildId
    );
    Alert.alert("Calendrier", result.message);
  };

  const onReminders = async () => {
    if (!notificationsSupported()) {
      Alert.alert(
        "Notifications",
        "Indisponibles sur le web. Sur appareil: Expo Go + permission notifications."
      );
      return;
    }
    const ok = await ensureNotificationPermissions();
    if (!ok) {
      Alert.alert("Permission refusee", "Activez les notifications.");
      return;
    }
    const n = await refreshReminders();
    Alert.alert("Rappels", n + " rappel(s) planifie(s).");
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Tableau de bord</Text>
        <Text style={styles.sub}>{formatFrenchDate(todayISO())}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
          <Pressable
            onPress={() => setFilterChildId("all")}
            style={[styles.chip, filterChildId === "all" && styles.chipActive]}
          >
            <Text style={[styles.chipText, filterChildId === "all" && styles.chipTextActive]}>Tous</Text>
          </Pressable>
          {childrenProfiles.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setFilterChildId(c.id)}
              style={[
                styles.chip,
                { borderColor: c.color },
                filterChildId === c.id && { backgroundColor: c.color },
              ]}
            >
              <Text style={[styles.chipText, filterChildId === c.id && { color: "#fff" }]}>
                {c.emoji} {c.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.statsRow}>
          {stats.map(({ child, total, done }) => (
            <View key={child.id} style={[styles.statCard, { borderColor: child.color }]}>
              <Text style={styles.statEmoji}>{child.emoji}</Text>
              <Text style={styles.statName}>{child.name}</Text>
              <Text style={styles.statValue}>
                {done}/{total}
              </Text>
              <Text style={styles.statLabel}>faites</Text>
            </View>
          ))}
        </View>

        <PrimaryButton
          label="Calendrier"
          variant="secondary"
          onPress={() => navigation.navigate("ParentCalendar")}
          style={{ marginBottom: 8 }}
        />
        {isAuthenticated ? (
          <PrimaryButton
            label={
              family?.inviteCode
                ? `Partage famille · ${family.inviteCode}`
                : "Partage famille"
            }
            variant="ghost"
            onPress={() => navigation.navigate("FamilyShare")}
            style={{ marginBottom: 8 }}
          />
        ) : null}
        <PrimaryButton
          label="+ Nouvelle tache"
          onPress={() => navigation.navigate("TaskForm", {})}
          style={{ marginBottom: 12 }}
        />

        <Text style={styles.section}>Aujourd hui</Text>
        {todayTasks.length === 0 ? (
          <Text style={styles.empty}>Aucune tache pour ce filtre.</Text>
        ) : (
          todayTasks.map((task) => {
            const child = childrenProfiles.find((c) => c.id === task.childId);
            const done = completionFor(task.id);
            return (
              <View key={task.id}>
                <TaskCard
                  task={task}
                  done={!!done}
                  childName={child?.name}
                  onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                  rightAccessory={
                    <Pressable
                      onPress={() => navigation.navigate("TaskForm", { taskId: task.id })}
                      style={styles.editBtn}
                    >
                      <Text>Edit</Text>
                    </Pressable>
                  }
                />
                {done?.photoUri ? (
                  <Image source={{ uri: done.photoUri }} style={styles.thumb} />
                ) : null}
              </View>
            );
          })
        )}

        <PrimaryButton label="Rappels du jour" variant="secondary" onPress={() => void onReminders()} style={{ marginTop: 8 }} />
        {(calendarSupported() || Platform.OS === "web") && (
          <PrimaryButton label="Ajouter au calendrier" variant="ghost" onPress={() => void onCalendar()} style={{ marginTop: 8 }} />
        )}
        <PrimaryButton
          label="Changer de profil"
          variant="ghost"
          onPress={() => {
            setCurrentProfileId(null);
            navigation.replace("ProfilePicker");
          }}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.parentBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  sub: { color: colors.textMuted, textTransform: "capitalize", marginTop: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontWeight: "700", color: colors.text },
  chipTextActive: { color: "#fff" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 2,
    alignItems: "center",
  },
  statEmoji: { fontSize: 28 },
  statName: { fontWeight: "700", marginTop: 4 },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.primary, marginTop: 4 },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  section: { fontWeight: "800", fontSize: 16, marginBottom: 8, color: colors.text },
  empty: { color: colors.textMuted, marginBottom: 12 },
  editBtn: {
    minWidth: 44,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  thumb: {
    height: 120,
    borderRadius: 12,
    marginTop: -4,
    marginBottom: 12,
    backgroundColor: colors.border,
  },
});
