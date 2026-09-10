import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
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
import { confirmUser, notifyUser } from "../utils/feedback";
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
  const { isAuthenticated, family, deleteAccount } = useAuth();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [filterChildId, setFilterChildId] = useState<string | "all">("all");
  const [moreOpen, setMoreOpen] = useState(false);

  const todayTasks = useMemo(() => {
    return state.tasks
      .filter((task) => isTaskForDate(task))
      .filter((task) => filterChildId === "all" || task.childId === filterChildId)
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
    const tasks = state.tasks.filter((task) => task.childId === child.id && isTaskForDate(task));
    const done = tasks.filter((task) => completionFor(task.id)).length;
    return { child, total: tasks.length, done };
  });

  const selectedChild =
    filterChildId === "all" ? null : childrenProfiles.find((c) => c.id === filterChildId) ?? null;
  const todayTitle = selectedChild
    ? t("parentDash.todayFor", { name: `${selectedChild.emoji} ${selectedChild.name}` })
    : t("parentDash.today");

  const visibleStats =
    filterChildId === "all" ? stats : stats.filter(({ child }) => child.id === filterChildId);

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
      Alert.alert(t("notifications.title"), t("notifications.webUnavailableParent"));
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

  const closeAnd = (fn: () => void) => {
    setMoreOpen(false);
    fn();
  };

  const goNewTask = () => navigation.navigate("TaskForm", {});


  const onDeleteAccount = () => {
    void (async () => {
      const step1 = await confirmUser(
        t("account.deleteTitle"),
        t("account.deleteBody"),
        t("account.deleteConfirm")
      );
      if (!step1) return;
      const step2 = await confirmUser(
        t("account.deleteFinalTitle"),
        t("account.deleteFinalBody"),
        t("account.deleteFinalConfirm")
      );
      if (!step2) return;
      setDeletingAccount(true);
      setMoreOpen(false);
      try {
        await deleteAccount();
        navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
      } catch (e) {
        notifyUser(
          t("common.error"),
          e instanceof Error ? e.message : t("account.deleteFailed")
        );
      } finally {
        setDeletingAccount(false);
      }
    })();
  };

  const shareLabel = family?.inviteCode
    ? t("parentDash.shareFamilyCode", { code: family.inviteCode })
    : t("parentDash.shareFamily");

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{t("parentDash.title")}</Text>
            <Text style={styles.sub}>{formatLocalizedDate(todayISO(), i18n.language)}</Text>
          </View>
          <Pressable
            onPress={() => setMoreOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("common.settings")}
            style={({ pressed }) => [styles.menuBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={styles.menuDots}>⋯</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          <Pressable
            onPress={() => setFilterChildId("all")}
            style={[styles.chip, filterChildId === "all" && styles.chipActive]}
          >
            <Text style={[styles.chipText, filterChildId === "all" && styles.chipTextActive]}>
              {t("common.all")}
            </Text>
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

        {visibleStats.length > 0 ? (
          <View style={styles.statsRow}>
            {visibleStats.map(({ child, total, done }) => {
              const isSelected = filterChildId === child.id;
              return (
                <Pressable
                  key={child.id}
                  onPress={() => setFilterChildId(isSelected ? "all" : child.id)}
                  style={[
                    styles.statCard,
                    { borderColor: child.color },
                    isSelected && styles.statCardSelected,
                    filterChildId === "all" && styles.statCardCompact,
                  ]}
                >
                  <Text style={styles.statEmoji}>{child.emoji}</Text>
                  <Text style={styles.statName} numberOfLines={1}>
                    {child.name}
                  </Text>
                  <Text style={styles.statValue}>
                    {done}/{total}
                  </Text>
                  <Text style={styles.statLabel}>{t("common.done")}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.compactRow}>
          <Pressable
            onPress={() => navigation.navigate("ParentCalendar")}
            style={({ pressed }) => [styles.compactBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.compactEmoji}>📅</Text>
            <Text style={styles.compactLabel} numberOfLines={1}>
              {t("parentDash.calendar")}
            </Text>
          </Pressable>
          {isAuthenticated ? (
            <Pressable
              onPress={() => navigation.navigate("FamilyShare")}
              style={({ pressed }) => [styles.compactBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.compactEmoji}>🔗</Text>
              <Text style={styles.compactLabel} numberOfLines={1}>
                {shareLabel}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => navigation.navigate("SignUp")}
              style={({ pressed }) => [styles.compactBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.compactEmoji}>🔗</Text>
              <Text style={styles.compactLabel} numberOfLines={1}>
                {t("parentDash.shareFamily")}
              </Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.section}>{todayTitle}</Text>
        {todayTasks.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.empty}>{t("parentDash.emptyFilter")}</Text>
            <PrimaryButton label={t("parentDash.newTask")} onPress={goNewTask} style={{ marginTop: 8 }} />
          </View>
        ) : (
          todayTasks.map((task) => {
            const child = childrenProfiles.find((c) => c.id === task.childId);
            const done = completionFor(task.id);
            return (
              <View key={task.id}>
                <TaskCard
                  task={task}
                  done={!!done}
                  completedAt={done?.completedAt}
                  childName={child?.name}
                  onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                  rightAccessory={
                    <Pressable
                      onPress={() => navigation.navigate("TaskForm", { taskId: task.id })}
                      style={styles.editBtn}
                    >
                      <Text style={styles.editBtnText}>{t("common.edit")}</Text>
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

        <View style={styles.childrenHeader}>
          <Text style={[styles.section, { marginBottom: 0 }]}>{t("parentDash.children")}</Text>
          <Pressable onPress={() => navigation.navigate("ChildForm", {})}>
            <Text style={styles.addChildLink}>{t("parentDash.addChild")}</Text>
          </Pressable>
        </View>
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

        {/* Spacer for sticky CTA */}
        <View style={{ height: 72 }} />
      </ScrollView>

      <View style={styles.stickyBar}>
        <PrimaryButton label={t("parentDash.newTask")} onPress={goNewTask} />
      </View>

      <Modal
        visible={moreOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMoreOpen(false)}>
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>{t("common.settings")}</Text>
            <PrimaryButton
              label={t("common.language")}
              variant="secondary"
              onPress={() => closeAnd(() => navigation.navigate("LanguageSettings"))}
              style={{ marginTop: 8 }}
            />
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
              label={t("parentDash.reminders")}
              variant="ghost"
              onPress={() => {
                setMoreOpen(false);
                void onReminders();
              }}
              style={{ marginTop: 8 }}
            />
            {calendarSupported() ? (
              <PrimaryButton
                label={t("parentDash.addCalendar")}
                variant="ghost"
                onPress={() => {
                  setMoreOpen(false);
                  void onCalendar();
                }}
                style={{ marginTop: 8 }}
              />
            ) : null}
            {isAuthenticated ? (
              <PrimaryButton
                label={t("account.delete")}
                variant="ghost"
                loading={deletingAccount}
                onPress={onDeleteAccount}
                style={{ marginTop: 8 }}
              />
            ) : null}
            <PrimaryButton
              label={t("common.cancel")}
              variant="ghost"
              onPress={() => setMoreOpen(false)}
              style={{ marginTop: 12 }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.parentBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: { padding: 16, paddingBottom: 24 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: { flex: 1 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  sub: { color: colors.textMuted, textTransform: "capitalize", marginTop: 2 },
  menuBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  menuDots: { fontSize: 22, fontWeight: "800", color: colors.text, marginTop: -4 },
  chipsScroll: { marginVertical: 12 },
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
  statCardCompact: { paddingVertical: 10 },
  statCardSelected: { borderWidth: 3, minWidth: "100%", flexBasis: "100%" },
  statEmoji: { fontSize: 28 },
  statName: { fontWeight: "700", marginTop: 4 },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.primary, marginTop: 4 },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  compactRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  compactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  compactEmoji: { fontSize: 18 },
  compactLabel: { flex: 1, fontWeight: "700", color: colors.primary, fontSize: 13 },
  section: { fontWeight: "800", fontSize: 16, marginBottom: 8, color: colors.text },
  emptyBox: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  empty: { color: colors.textMuted },
  childrenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 8,
  },
  addChildLink: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  kidsManage: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
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
  editBtn: {
    minWidth: 44,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  editBtnText: { fontWeight: "700", color: colors.text, fontSize: 13 },
  thumb: {
    height: 120,
    borderRadius: 12,
    marginTop: -4,
    marginBottom: 12,
    backgroundColor: colors.border,
  },
  stickyBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 20 : 12,
    backgroundColor: colors.parentBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
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
