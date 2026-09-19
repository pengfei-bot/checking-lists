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
import { rewardsUi } from "../theme/rewardsUi";
import { RootStackParamList } from "../navigation/types";
import { TaskCard } from "../components/TaskCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { formatLocalizedDate, todayISO } from "../utils/dates";
import { unitShortKey } from "../utils/rewards";
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
    isRewardsActiveForChild,
    unitKindFor,
    balanceFor,
    pointsFor,
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
  const balance = balanceFor(currentProfile.id);
  const unitLabel = t(unitShortKey(unitKindFor(currentProfile.id)));
  const rewardsActive = isRewardsActiveForChild(currentProfile.id);

  const header = useMemo(
    () => (
      <>
        <View
          style={[
            styles.hero,
            {
              backgroundColor: rewardsActive
                ? rewardsUi.peach
                : currentProfile.color + "22",
            },
          ]}
        >
          <View style={styles.heroTop}>
            <Text style={styles.heroEmoji}>{currentProfile.emoji}</Text>
            <Pressable
              onPress={() => setMenuOpen(true)}
              style={styles.moreBtn}
              accessibilityRole="button"
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
        {rewardsActive ? (
          <Pressable
            onPress={() => navigation.navigate("RewardsChild", { childId: currentProfile.id })}
            style={styles.soldeCard}
            accessibilityRole="button"
            accessibilityLabel={t("rewards.soldeChip", { amount: balance, unit: unitLabel })}
          >
            <View style={styles.soldeStarCircle}>
              <Text style={styles.soldeStar}>⭐</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.soldeLabel}>{t("rewards.soldeLabel")}</Text>
              <Text style={styles.soldeValue}>
                {balance} <Text style={styles.soldeUnit}>{unitLabel}</Text>
              </Text>
            </View>
            <View style={styles.historyCtaMini}>
              <Text style={styles.historyCtaMiniText}>{t("rewards.myHistory")} ›</Text>
            </View>
          </Pressable>
        ) : null}
      </>
    ),
    [currentProfile, doneCount, tasks.length, progress, balance, rewardsActive, unitLabel, t, i18n.language, navigation]
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
      <ScrollView contentContainerStyle={styles.container}>
        {header}
        {tasks.length === 0 ? (
          <Text style={styles.empty}>{t("childHome.empty")}</Text>
        ) : (
          tasks.map((task) => {
            const done = !!completionFor(task.id);
            const pts = rewardsActive ? pointsFor(task.id) : null;
            return (
              <TaskCard
                key={task.id}
                task={task}
                done={done}
                hasPhoto={!!completionFor(task.id)?.photoUri}
                pointsLabel={pts != null ? `+${pts} ${unitLabel}` : null}
                onPress={() => navigation.navigate("TaskDetail", { taskId: task.id, date: todayISO() })}
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
                      <Pressable
                        style={styles.miniBtn}
                        onPress={() => void doneWithPhoto(task.id)}
                        accessibilityLabel={
                          task.photoRequired
                            ? t("photoRequired.addToValidate")
                            : t("taskDetail.childDonePhoto")
                        }
                      >
                        <Text style={styles.miniText}>📷</Text>
                      </Pressable>
                    )}
                  </View>
                }
              />
            );
          })
        )}

        {rewardsActive ? (
          <Pressable
            style={styles.rewardsHistoryChip}
            onPress={() => navigation.navigate("RewardsChild", { childId: currentProfile.id })}
            accessibilityRole="button"
            accessibilityLabel={t("rewards.myHistory")}
          >
            <Text style={styles.rewardsHistoryChipText}>⭐ {t("rewards.myHistory")}</Text>
          </Pressable>
        ) : null}
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
  hero: { borderRadius: 20, padding: 18, marginBottom: 12 },
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
  soldeCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#D6E0FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  soldeStarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  soldeStar: { fontSize: 26 },
  soldeLabel: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  soldeValue: { fontSize: 26, fontWeight: "800", color: colors.primary, marginTop: 2 },
  soldeUnit: { fontSize: 18, fontWeight: "800", color: colors.primary },
  historyCtaMini: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "#fff",
  },
  historyCtaMiniText: { fontWeight: "800", color: colors.primary, fontSize: 12 },
  empty: { textAlign: "center", color: colors.textMuted, marginVertical: 24, fontSize: 16 },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
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
  rewardsHistoryChip: {
    marginTop: 16,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: 0,
    justifyContent: "center",
  },
  rewardsHistoryChipText: { fontWeight: "800", color: colors.primary, fontSize: 15 },
  historyChip: {
    marginTop: 12,
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
