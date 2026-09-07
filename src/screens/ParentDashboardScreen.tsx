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
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";
import { useParentOnlyGuard } from "../navigation/useParentOnlyGuard";
import { TaskCard } from "../components/TaskCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { formatLocalizedDate, todayISO } from "../utils/dates";
import { isTaskForDate } from "../utils/recurrence";
import { addTodayTasksToCalendar, calendarSupported } from "../services/calendar";
import { ensureNotificationPermissions, notificationsSupported } from "../services/notifications";

type Props = NativeStackScreenProps<RootStackParamList, "ParentDashboard">;

export function ParentDashboardScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const blocked = useParentOnlyGuard(navigation);
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

  const todayTasks = useMemo(() => {
    return state.tasks
      .filter((t) => isTaskForDate(t))
      .filter((t) => filterChildId === "all" || t.childId === filterChildId)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [state.tasks, filterChildId]);

  if (blocked || !currentProfile || currentProfile.role !== "parent") {
    return (
      <View style={styles.center}>
        <Text>{blocked ? t("roles.parentOnly") : t("roles.parentRequired")}</Text>
        <PrimaryButton
          label={t("common.changeProfile")}
          onPress={() => {
            setCurrentProfileId(null);
            navigation.replace("ProfilePicker");
          }}
          style={{ marginTop: 12 }}
        />
      </View>
    );
  }

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
    Alert.alert(t("deviceCalendar.title"), result.message);
  };

  const onReminders = async () => {
    if (!notificationsSupported()) {
      Alert.alert(
        t("notifications.title"),
        t("notifications.webUnavailableParent")
      );
      return;
    }
    const ok = await ensureNotificationPermissions();
    if (!ok) {
      Alert.alert(t("notifications.deniedTitle"), t("notifications.deniedBodyShort"));
      return;
    }
    const n = await refreshReminders();
    Alert.alert(t("notifications.remindersTitle"), t("notifications.remindersScheduledShort", { count: n }));
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t("parentDash.title")}</Text>
        <Text style={styles.sub}>{formatLocalizedDate(todayISO(), i18n.language)}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
          <Pressable
            onPress={() => setFilterChildId("all")}
            style={[styles.chip, filterChildId === "all" && styles.chipActive]}
          >
            <Text style={[styles.chipText, filterChildId === "all" && styles.chipTextActive]}>{t("common.all")}</Text>
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
              <Text style={styles.statLabel}>{t("common.done")}</Text>
            </View>
          ))}
        </View>

        <PrimaryButton
          label={t("parentDash.calendar")}
          variant="secondary"
          onPress={() => navigation.navigate("ParentCalendar")}
          style={{ marginBottom: 8 }}
        />
        {isAuthenticated ? (
          <PrimaryButton
            label={
              family?.inviteCode
                ? t("parentDash.shareFamilyCode", { code: family.inviteCode })
                : t("parentDash.shareFamily")
            }
            variant="ghost"
            onPress={() => navigation.navigate("FamilyShare")}
            style={{ marginBottom: 8 }}
          />
        ) : null}
        <PrimaryButton
          label={t("parentDash.newTask")}
          onPress={() => navigation.navigate("TaskForm", {})}
          style={{ marginBottom: 8 }}
        />
        <PrimaryButton
          label={t("parentDash.addChild")}
          variant="secondary"
          onPress={() => navigation.navigate("ChildForm", {})}
          style={{ marginBottom: 12 }}
        />

        <Text style={styles.section}>{t("parentDash.children")}</Text>
        <View style={styles.kidsManage}>
          {childrenProfiles.map((child) => (
            <Pressable
              key={`manage-${child.id}`}
              onPress={() => navigation.navigate("ChildForm", { childId: child.id })}
              style={[styles.kidManageCard, { borderColor: child.color }]}
            >
              <Text style={styles.statEmoji}>{child.emoji}</Text>
              <Text style={styles.kidManageName}>{child.name}</Text>
              <Text style={styles.kidManageEdit}>{t("common.edit")}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>{t("parentDash.today")}</Text>
        {todayTasks.length === 0 ? (
          <Text style={styles.empty}>{t("parentDash.emptyFilter")}</Text>
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
                      <Text>{t("parentDash.edit")}</Text>
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

        <PrimaryButton label={t("parentDash.reminders")} variant="secondary" onPress={() => void onReminders()} style={{ marginTop: 8 }} />
        {calendarSupported() && (
          <PrimaryButton label={t("parentDash.addCalendar")} variant="ghost" onPress={() => void onCalendar()} style={{ marginTop: 8 }} />
        )}
        <PrimaryButton
          label={t("common.language")}
          variant="ghost"
          onPress={() => navigation.navigate("LanguageSettings")}
          style={{ marginTop: 8 }}
        />
        <PrimaryButton
          label={t("common.changeProfile")}
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
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  statCard: {
    minWidth: "45%",
    flexGrow: 1,
    flexBasis: "40%",
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
  kidsManage: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  kidManageCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  kidManageName: { fontWeight: "700", color: colors.text },
  kidManageEdit: { color: colors.primary, fontWeight: "600", fontSize: 12 },
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
