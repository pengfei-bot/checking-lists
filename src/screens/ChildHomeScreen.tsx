import React, { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";
import { TaskCard } from "../components/TaskCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { formatLocalizedDate, todayISO } from "../utils/dates";
import { notifyUser } from "../utils/feedback";
import { MOCK_PHOTO_URI, pickProofImage } from "../utils/pickImage";
import { ensureNotificationPermissions, notificationsSupported } from "../services/notifications";
import { addTodayTasksToCalendar, calendarSupported } from "../services/calendar";

type Props = NativeStackScreenProps<RootStackParamList, "ChildHome">;

export function ChildHomeScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const {
    currentProfile,
    tasksForChildToday,
    completionFor,
    markTaskDone,
    unmarkTaskDone,
    setCurrentProfileId,
    state,
    refreshReminders,
  } = useApp();

  if (!currentProfile || currentProfile.role !== "child") {
    return (
      <View style={styles.center}>
        <Text>{t("roles.childRequired")}</Text>
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

  const tasks = tasksForChildToday(currentProfile.id);
  const doneCount = tasks.filter((task) => completionFor(task.id)).length;
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const header = useMemo(
    () => (
      <View style={[styles.hero, { backgroundColor: currentProfile.color + "22" }]}>
        <Text style={styles.heroEmoji}>{currentProfile.emoji}</Text>
        <Text style={styles.heroTitle}>{t("childHome.hello", { name: currentProfile.name })}</Text>
        <Text style={styles.heroSub}>{formatLocalizedDate(todayISO(), i18n.language)}</Text>
        <Text style={styles.progress}>
          {t("childHome.progress", { done: doneCount, total: tasks.length, percent: progress })}
        </Text>
      </View>
    ),
    [currentProfile, doneCount, tasks.length, progress, t, i18n.language]
  );

  const quickDone = async (taskId: string) => {
    const existing = completionFor(taskId);
    if (existing) {
      await unmarkTaskDone(taskId);
      return;
    }
    await markTaskDone(taskId, currentProfile.id);
  };

  const doneWithPhoto = async (taskId: string) => {
    const result = await pickProofImage({ quality: 0.6, preferCamera: true });
    if (result.status === "canceled") {
      notifyUser(t("photo.title"), t("photo.canceled"));
      return;
    }
    if (result.status === "error") {
      await markTaskDone(taskId, currentProfile.id, MOCK_PHOTO_URI);
      notifyUser(t("photo.title"), t("photo.demoUsed", { message: result.message }));
      return;
    }
    await markTaskDone(taskId, currentProfile.id, result.uri);
    notifyUser(t("photo.title"), t("photo.saved"));
  };

  const onReminders = async () => {
    if (!notificationsSupported()) {
      notifyUser(t("notifications.title"), t("notifications.webUnavailable"));
      return;
    }
    const ok = await ensureNotificationPermissions();
    if (!ok) {
      notifyUser(t("notifications.deniedTitle"), t("notifications.deniedBody"));
      return;
    }
    const n = await refreshReminders();
    notifyUser(t("notifications.remindersTitle"), t("notifications.remindersScheduled", { count: n }));
  };

  const onCalendar = async () => {
    const result = await addTodayTasksToCalendar(state.tasks, state.profiles, currentProfile.id);
    notifyUser(t("deviceCalendar.title"), result.message);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        {header}
        {tasks.length === 0 ? (
          <Text style={styles.empty}>{t("childHome.empty")}</Text>
        ) : (
          tasks.map((task) => {
            const done = !!completionFor(task.id);
            return (
              <TaskCard
                key={task.id}
                task={task}
                done={done}
                onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                rightAccessory={
                  <View style={styles.actions}>
                    <Pressable style={styles.miniBtn} onPress={() => void quickDone(task.id)}>
                      <Text style={styles.miniText}>{done ? t("common.undo") : t("common.ok")}</Text>
                    </Pressable>
                    {!done && (
                      <Pressable style={styles.miniBtn} onPress={() => void doneWithPhoto(task.id)}>
                        <Text style={styles.miniText}>{t("common.photo")}</Text>
                      </Pressable>
                    )}
                  </View>
                }
              />
            );
          })
        )}

        <PrimaryButton
          label={t("childHome.history")}
          variant="secondary"
          onPress={() => navigation.navigate("ChildHistory")}
          style={{ marginTop: 8 }}
        />
        <PrimaryButton
          label={t("common.language")}
          variant="ghost"
          onPress={() => navigation.navigate("LanguageSettings")}
          style={{ marginTop: 8 }}
        />
        <PrimaryButton
          label={t("childHome.reminders")}
          variant="secondary"
          onPress={() => void onReminders()}
          style={{ marginTop: 8 }}
        />
        {calendarSupported() && (
          <PrimaryButton
            label={t("childHome.addToCalendar")}
            variant="ghost"
            onPress={() => void onCalendar()}
            style={{ marginTop: 8 }}
          />
        )}
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
  root: { flex: 1, backgroundColor: colors.kidBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: { padding: 16, paddingBottom: 40 },
  hero: { borderRadius: 20, padding: 18, marginBottom: 16 },
  heroEmoji: { fontSize: 40 },
  heroTitle: { fontSize: 24, fontWeight: "800", color: colors.text, marginTop: 4 },
  heroSub: { color: colors.textMuted, textTransform: "capitalize", marginTop: 2 },
  progress: { marginTop: 10, fontWeight: "700", color: colors.primary },
  empty: { textAlign: "center", color: colors.textMuted, marginVertical: 24, fontSize: 16 },
  actions: { flexDirection: "row", gap: 6 },
  miniBtn: {
    minWidth: 44,
    height: 40,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  miniText: { fontSize: 11, fontWeight: "800", color: colors.primary },
});
