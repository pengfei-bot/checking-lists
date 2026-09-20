import React, { useCallback, useMemo, useState } from "react";
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
import { ColorChips } from "../components/ColorChips";
import { colors, softTint } from "../theme/colors";
import { rewardsStyles, rewardsUi } from "../theme/rewardsUi";
import { frenchCloudError } from "../utils/cloudTimeout";
import { RootStackParamList } from "../navigation/types";
import { openProfileSwitcher } from "../navigation/openProfileSwitcher";
import { PrimaryButton } from "../components/PrimaryButton";
import { todayISO } from "../utils/dates";
import { unitShortKey } from "../utils/rewards";
import { notifyUser } from "../utils/feedback";
import { MOCK_PHOTO_URI, pickProofImage } from "../utils/pickImage";
import { ensureNotificationPermissions, notificationsSupported } from "../services/notifications";
import { addTodayTasksToCalendar, calendarSupported } from "../services/calendar";
import { ChildRewardsBottomNav } from "../components/RewardsBottomNav";
import { RewardCelebration } from "../components/RewardCelebration";
import type { RewardUnitKind } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "ChildHome">;

export function ChildHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const {
    currentProfile,
    tasksForChildToday,
    completionFor,
    markTaskDone,
    unmarkTaskDone,
    state,
    refreshReminders,
    isRewardsActiveForChild,
    unitKindFor,
    balanceFor,
    pointsFor,
    updateChild,
  } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [colorBusy, setColorBusy] = useState(false);
  /** Per-task reward burst after a successful complete (rewards + points). */
  const [burst, setBurst] = useState<{
    taskId: string;
    amount: number;
    unitKind: RewardUnitKind;
    key: number;
  } | null>(null);

  const clearBurst = useCallback(() => setBurst(null), []);

  const maybeCelebrate = useCallback(
    (taskId: string) => {
      if (!currentProfile || currentProfile.role !== "child") return;
      if (!isRewardsActiveForChild(currentProfile.id)) return;
      const pts = pointsFor(taskId);
      if (pts == null || pts <= 0) return;
      setBurst({
        taskId,
        amount: pts,
        unitKind: unitKindFor(currentProfile.id),
        key: Date.now(),
      });
    },
    [currentProfile, isRewardsActiveForChild, pointsFor, unitKindFor]
  );

  // Hooks must run even when currentProfile is null mid-switch (Rules of Hooks).
  const childId = currentProfile?.role === "child" ? currentProfile.id : null;
  const tasks = childId ? tasksForChildToday(childId) : [];
  const doneCount = tasks.filter((task) => completionFor(task.id)).length;
  const balance = childId ? balanceFor(childId) : 0;
  const unitLabel = t(unitShortKey(unitKindFor(childId ?? "")));
  const rewardsActive = childId ? isRewardsActiveForChild(childId) : false;
  const possibleStars = useMemo(() => {
    if (!rewardsActive) return 0;
    return tasks.reduce((sum, task) => sum + (pointsFor(task.id) ?? 0), 0);
  }, [tasks, rewardsActive, pointsFor]);

  if (!currentProfile || currentProfile.role !== "child" || !childId) {
    return (
      <View style={styles.center}>
        <Text>{t("roles.childRequired")}</Text>
        <PrimaryButton
          label={t("common.changeProfile")}
          onPress={() => openProfileSwitcher(navigation)}
          style={{ marginTop: 12 }}
        />
      </View>
    );
  }

  const quickDone = async (taskId: string) => {
    const existing = completionFor(taskId);
    if (existing) {
      await unmarkTaskDone(taskId);
      return;
    }
    await markTaskDone(taskId, currentProfile.id);
    maybeCelebrate(taskId);
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
      maybeCelebrate(taskId);
      return;
    }
    await markTaskDone(taskId, currentProfile.id, result.uri);
    notifyUser(t("photo.title"), t("photo.saved"));
    maybeCelebrate(taskId);
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

  const onChangeColor = (next: string) => {
    if (!currentProfile || currentProfile.role !== "child") return;
    if (next === currentProfile.color) return;
    void (async () => {
      setColorBusy(true);
      try {
        await updateChild(currentProfile.id, {
          name: currentProfile.name,
          emoji: currentProfile.emoji,
          color: next,
        });
        notifyUser(t("childHome.colorUpdated"), t("childHome.colorUpdatedBody"));
      } catch (e) {
        notifyUser(t("common.error"), frenchCloudError(e, t("childForm.saveFailed")));
      } finally {
        setColorBusy(false);
      }
    })();
  };

  const childColor = currentProfile.color || rewardsUi.peach;
  const headerTint = softTint(childColor, 0.28);
  const rowTint = softTint(childColor, 0.1);

  return (
    <View style={[styles.root, { backgroundColor: softTint(childColor, 0.08) }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Soft tint header band from child color — M5 */}
        <View style={[styles.peachHeader, { backgroundColor: headerTint }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.hello}>
                {t("childHome.hello", { name: currentProfile.name })} {currentProfile.emoji}
              </Text>
              <Text style={styles.ready}>{t("childHome.readyLine")}</Text>
            </View>
            <View style={styles.mascotWrap}>
              <Pressable
                onPress={() => setMenuOpen(true)}
                style={styles.moreBtn}
                accessibilityRole="button"
                accessibilityLabel={t("childHome.more")}
              >
                <Text style={styles.moreBtnText}>⋯</Text>
              </Pressable>
            </View>
          </View>

          {rewardsActive ? (
            <Pressable
              onPress={() => navigation.navigate("RewardsChild", { childId: currentProfile.id })}
              style={styles.soldeCard}
              accessibilityRole="button"
              accessibilityLabel={t("rewards.soldeChip", { amount: balance, unit: unitLabel })}
            >
              <View style={rewardsStyles.soldeStarCircle}>
                <Text style={rewardsStyles.soldeStar}>⭐</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={rewardsStyles.soldeLabel}>{t("rewards.soldeHistoryLabel")}</Text>
                <Text style={rewardsStyles.soldeValue}>
                  {balance} <Text style={styles.soldeStarInline}>⭐</Text>
                </Text>
              </View>
              <Text style={styles.soldeChevron} accessibilityElementsHidden>
                ›
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* White body sheet */}
        <View style={styles.bodySheet}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>
              {currentProfile.emoji} {t("childHome.tasksToday")}
            </Text>
            {rewardsActive ? (
              <Text style={styles.sectionMeta}>
                {t("childHome.tasksPossible", {
                  count: tasks.length,
                  stars: possibleStars,
                })}
              </Text>
            ) : (
              <Text style={styles.sectionMeta}>
                {doneCount}/{tasks.length}
              </Text>
            )}
          </View>

          {tasks.length === 0 ? (
            <Text style={styles.empty}>{t("childHome.empty")}</Text>
          ) : (
            tasks.map((task) => {
              const done = !!completionFor(task.id);
              const pts = rewardsActive ? pointsFor(task.id) : null;
              return (
                <View
                  key={task.id}
                  style={[
                    styles.taskRow,
                    {
                      borderLeftWidth: 4,
                      borderLeftColor: childColor,
                      backgroundColor: done ? colors.successSoft : rowTint,
                    },
                    done && styles.taskRowDone,
                  ]}
                >
                  <View style={styles.checkboxWrap}>
                    <Pressable
                      style={[styles.checkbox, done && styles.checkboxDone]}
                      onPress={() => void quickDone(task.id)}
                      accessibilityLabel={done ? t("childHome.unmarkA11y") : t("childHome.markDoneA11y")}
                    >
                      <Text style={[styles.checkboxText, done && styles.checkboxTextDone]}>
                        {done ? "✓" : ""}
                      </Text>
                    </Pressable>
                  </View>

                  <Pressable
                    style={styles.taskMain}
                    onPress={() => navigation.navigate("TaskDetail", { taskId: task.id, date: todayISO() })}
                  >
                    <Text style={[styles.taskTitle, done && styles.taskTitleDone]} numberOfLines={2}>
                      {task.title}
                    </Text>
                    <Text style={styles.taskMeta}>🕒 {task.time}</Text>
                  </Pressable>

                  <Pressable
                    style={styles.camBtn}
                    onPress={() => void doneWithPhoto(task.id)}
                    accessibilityLabel={
                      task.photoRequired
                        ? t("photoRequired.addToValidate")
                        : t("taskDetail.childDonePhoto")
                    }
                  >
                    <Text style={styles.camText}>{completionFor(task.id)?.photoUri ? "✓📷" : "📷"}</Text>
                  </Pressable>

                  {pts != null ? (
                    <View style={rewardsStyles.pointsPill}>
                      <Text style={rewardsStyles.pointsPillText}>
                        +{pts} {unitLabel === "€" ? "€" : "⭐"}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

        </View>
      </ScrollView>

      {burst ? (
        <RewardCelebration
          key={burst.key}
          amount={burst.amount}
          unitKind={burst.unitKind}
          onFinished={clearBurst}
        />
      ) : null}

      <ChildRewardsBottomNav
        navigation={navigation}
        active="home"
        childId={currentProfile.id}
        rewardsActive={rewardsActive}
      />

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
            <Text style={styles.colorSectionLabel}>{t("childHome.colorSection")}</Text>
            <View style={styles.colorRow} pointerEvents={colorBusy ? "none" : "auto"}>
              <ColorChips value={currentProfile.color} onChange={onChangeColor} />
            </View>
            <PrimaryButton
              label={t("common.changeProfile")}
              variant="ghost"
              onPress={() =>
                closeAnd(() => {
                  openProfileSwitcher(navigation);
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
  root: { flex: 1, backgroundColor: rewardsUi.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  scroll: { paddingBottom: 8 },
  peachHeader: {
    backgroundColor: rewardsUi.peach,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  hello: {
    fontSize: 26,
    fontWeight: "800",
    color: rewardsUi.navy,
    lineHeight: 32,
  },
  ready: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "600",
    color: rewardsUi.navy,
    opacity: 0.85,
  },
  mascotWrap: { alignItems: "flex-end", gap: 6 },
  mascot: { fontSize: 52, lineHeight: 56 },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffffcc",
    alignItems: "center",
    justifyContent: "center",
  },
  moreBtnText: { fontSize: 18, fontWeight: "800", color: rewardsUi.navy },
  soldeCard: {
    ...rewardsStyles.soldeCard,
    marginTop: 14,
  },
  soldeStarInline: { fontSize: 18 },
  soldeChevron: { fontSize: 28, fontWeight: "300", color: rewardsUi.navyMuted, marginRight: 4 },
  bodySheet: {
    backgroundColor: "#fff",
    marginTop: -8,
    marginHorizontal: 0,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 320,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: rewardsUi.navy,
    flexShrink: 1,
  },
  sectionMeta: { fontSize: 12, fontWeight: "600", color: rewardsUi.navyMuted },
  empty: { textAlign: "center", color: colors.textMuted, marginVertical: 24, fontSize: 16 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: rewardsUi.rowRadius,
    borderWidth: 1,
    borderColor: "#EEF0F4",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    overflow: "visible",
    ...rewardsUi.shadow,
  },
  taskRowDone: { backgroundColor: colors.successSoft, borderColor: "#C8E6D4" },
  checkboxWrap: {
    width: 28,
    height: 28,
    position: "relative",
    overflow: "visible",
    zIndex: 2,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkboxText: { fontSize: 14, fontWeight: "800", color: colors.primary },
  checkboxTextDone: { color: "#fff" },
  taskMain: { flex: 1, minWidth: 0 },
  taskTitle: { fontSize: 15, fontWeight: "800", color: rewardsUi.navy },
  taskTitleDone: { textDecorationLine: "line-through", color: colors.textMuted },
  taskMeta: { marginTop: 3, fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  camBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  camText: { fontSize: 18 },
  historyChip: {
    marginTop: 10,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: rewardsUi.peachSoft,
  },
  historyChipText: { fontWeight: "800", color: rewardsUi.navy, fontSize: 14 },
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
  colorSectionLabel: {
    marginTop: 14,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: "800",
    color: rewardsUi.navyMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  colorRow: { marginBottom: 4 },
});
