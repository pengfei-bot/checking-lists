import React, { useMemo, useState } from "react";
import {
  Modal,
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
import { OfflineBanner } from "../components/OfflineBanner";
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
    cloudSync,
    usingCache,
    isSyncing,
    syncError,
    cacheSavedAt,
    reloadFromCloud,
  } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

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
        <View style={styles.heroTop}>
          <Text style={styles.heroEmoji}>{currentProfile.emoji}</Text>
          <Pressable
            onPress={() => setMenuOpen(true)}
            style={styles.moreBtn}
            accessibilityLabel={t("childHome.more")}
          >
            <Text style={styles.moreBtnText}>⋯</Text>
          </Pressable>
        </View>
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
    setMenuOpen(false);
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
    setMenuOpen(false);
    const result = await addTodayTasksToCalendar(state.tasks, state.profiles, currentProfile.id);
    notifyUser(t("deviceCalendar.title"), result.message);
  };

  const closeAnd = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  return (
    <View style={styles.root}>
      <OfflineBanner
        visible={cloudSync && (usingCache || syncError === "offline")}
        syncing={isSyncing}
        cachedAt={cacheSavedAt}
        onRetry={() => { void reloadFromCloud(); }}
      />
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
                    <Pressable
                      style={styles.miniBtn}
                      onPress={() => void quickDone(task.id)}
                      accessibilityLabel={done ? t("childHome.unmarkA11y") : t("childHome.markDoneA11y")}
                    >
                      <Text style={styles.miniText}>{done ? "↩️" : "○"}</Text>
                    </Pressable>
                    {!done && (
                      <Pressable style={styles.miniBtn} onPress={() => void doneWithPhoto(task.id)}>
                        <Text style={styles.miniText}>📷</Text>
                      </Pressable>
                    )}
                  </View>
                }
              />
            );
          })
        )}

        <Pressable
          style={styles.historyChip}
          onPress={() => navigation.navigate("ChildHistory")}
        >
          <Text style={styles.historyChipText}>📅 {t("childHome.history")}</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>{t("childHome.more")}</Text>
            <PrimaryButton
              label={t("common.language")}
              variant="secondary"
              onPress={() => closeAnd(() => navigation.navigate("LanguageSettings"))}
              style={{ marginTop: 8 }}
            />
            <PrimaryButton
              label={t("childHome.reminders")}
              variant="ghost"
              onPress={() => void onReminders()}
              style={{ marginTop: 8 }}
            />
            {calendarSupported() ? (
              <PrimaryButton
                label={t("childHome.addToCalendar")}
                variant="ghost"
                onPress={() => void onCalendar()}
                style={{ marginTop: 8 }}
              />
            ) : null}
            <PrimaryButton
              label={t("common.changeProfile")}
              variant="ghost"
              onPress={() =>
                closeAnd(() => {
                  setCurrentProfileId(null);
                  navigation.replace("ProfilePicker");
                })
              }
              style={{ marginTop: 8 }}
            />
            <PrimaryButton
              label={t("common.cancel")}
              variant="ghost"
              onPress={() => setMenuOpen(false)}
              style={{ marginTop: 12 }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.kidBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: { padding: 16, paddingBottom: 40 },
  hero: { borderRadius: 20, padding: 18, marginBottom: 16 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroEmoji: { fontSize: 40 },
  moreBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffffaa",
    alignItems: "center",
    justifyContent: "center",
  },
  moreBtnText: { fontSize: 22, fontWeight: "800", color: colors.text },
  heroTitle: { fontSize: 24, fontWeight: "800", color: colors.text, marginTop: 4 },
  heroSub: { color: colors.textMuted, textTransform: "capitalize", marginTop: 2 },
  progress: { marginTop: 10, fontWeight: "700", color: colors.primary },
  empty: { textAlign: "center", color: colors.textMuted, marginVertical: 24, fontSize: 16 },
  actions: { flexDirection: "row", gap: 6 },
  miniBtn: {
    minWidth: 48,
    height: 48,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  miniText: { fontSize: 20 },
  historyChip: {
    marginTop: 16,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  historyChipText: { fontWeight: "800", color: colors.primary, fontSize: 15 },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "#00000066",
    justifyContent: "flex-end",
  },
  menuSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
});
