import React, { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useApp } from "../context/AppContext";
import { colors, softTint } from "../theme/colors";
import { rewardsStyles, rewardsUi } from "../theme/rewardsUi";
import { RootStackParamList } from "../navigation/types";
import { useParentOnlyGuard } from "../navigation/useParentOnlyGuard";
import { TaskCard } from "../components/TaskCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { formatCompletionTime, formatLocalizedDate, todayISO } from "../utils/dates";
import { isTaskForDate } from "../utils/recurrence";
import { unitShortKey } from "../utils/rewards";
import { ParentRewardsBottomNav } from "../components/RewardsBottomNav";
import { BuildStamp } from "../components/BuildStamp";

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
    isRewardsActiveForChild,
    pointsFor,
    unitKindFor,
    balanceFor,
  } = useApp();
  const [filterChildId, setFilterChildId] = useState<string | "all">("all");
  const [lightbox, setLightbox] = useState<{
    uri: string;
    title?: string;
    subtitle?: string;
  } | null>(null);

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
            navigation.replace("ProfilePicker", { mode: "switch" });
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




  const goNewTask = () => navigation.navigate("TaskForm", {});



  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{t("parentDash.title")}</Text>
            <Text style={styles.sub}>{formatLocalizedDate(todayISO(), i18n.language)}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          <Pressable
            onPress={() => setFilterChildId("all")}
            style={[
              rewardsStyles.filterChip,
              filterChildId === "all" && rewardsStyles.filterChipActiveOrange,
            ]}
          >
            <Text
              style={[
                rewardsStyles.filterChipText,
                filterChildId === "all" && rewardsStyles.filterChipTextActive,
              ]}
            >
              {t("common.all")}
            </Text>
          </Pressable>
          {childrenProfiles.map((c) => {
            const active = filterChildId === c.id;
            const chipColor = c.color || colors.primary;
            return (
              <Pressable
                key={c.id}
                onPress={() => setFilterChildId(c.id)}
                style={[
                  rewardsStyles.filterChip,
                  {
                    borderColor: chipColor,
                    backgroundColor: active ? chipColor : softTint(chipColor, 0.14),
                  },
                ]}
              >
                <Text
                  style={[
                    rewardsStyles.filterChipText,
                    active && { color: "#fff" },
                  ]}
                >
                  {c.emoji} {c.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* M2: tasks-first — only show cream selected-child card when filtered */}
        {selectedChild ? (
          <View style={styles.statsRow}>
            {visibleStats.map(({ child, total, done }) => (
              <Pressable
                key={child.id}
                onPress={() => setFilterChildId("all")}
                style={({ pressed }) => [
                  styles.statCard,
                  styles.statCardSelected,
                  {
                    backgroundColor: softTint(child.color || colors.primary, 0.18),
                    borderWidth: 2,
                    borderColor: child.color || colors.primary,
                  },
                  pressed ? { opacity: 0.92 } : null,
                  { outlineWidth: 0, outlineStyle: "solid", outlineColor: "transparent" } as object,
                ]}
              >
                <View
                  style={[
                    styles.childAvatar,
                    {
                      backgroundColor: softTint(child.color || colors.primary, 0.35),
                      borderColor: child.color || colors.primary,
                    },
                  ]}
                >
                  <Text style={styles.statEmoji}>{child.emoji}</Text>
                </View>
                <Text style={styles.statName} numberOfLines={1}>
                  {child.name}
                </Text>
                <Text style={styles.statValue}>
                  {done}/{total}
                </Text>
                <Text style={styles.statLabel}>{t("common.done")}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

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
                  hasPhoto={!!done?.photoUri}
                  childName={child?.name}
                  pointsLabel={
                    isRewardsActiveForChild(task.childId) && pointsFor(task.id) != null
                      ? `+${pointsFor(task.id)} ${unitKindFor(task.childId) === "money" ? "€" : "⭐"}`
                      : null
                  }
                  iconEmoji={undefined}
                  onPress={() => navigation.navigate("TaskDetail", { taskId: task.id, date: todayISO() })}
                  rightAccessory={
                    <Pressable
                      onPress={() => navigation.navigate("TaskForm", { taskId: task.id })}
                      style={styles.editBtn}
                      accessibilityLabel={t("common.edit")}
                      hitSlop={8}
                    >
                      <Text style={styles.editBtnText}>✎</Text>
                    </Pressable>
                  }
                />
                {done?.photoUri ? (
                  <Pressable
                    onPress={() => {
                      const time = done.completedAt
                        ? formatCompletionTime(done.completedAt, i18n.language)
                        : null;
                      const parts = [todayTitle];
                      if (time) parts.push(t("common.doneAt", { time }));
                      if (child?.name) parts.push(child.name);
                      setLightbox({
                        uri: done.photoUri!,
                        title: task.title,
                        subtitle: parts.join(" · "),
                      });
                    }}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={t("photo.viewFull")}
                    accessibilityHint={t("photo.tapToEnlarge")}
                  >
                    <Image source={{ uri: done.photoUri }} style={styles.thumb} resizeMode="cover" />
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}

        {selectedChild && isRewardsActiveForChild(selectedChild.id) ? (
          <Pressable
            onPress={() => navigation.navigate("RewardsChild", { childId: selectedChild.id })}
            style={styles.balanceCard}
            accessibilityRole="button"
            accessibilityLabel={t("parentDash.openRewards")}
          >
            <View style={styles.balanceStarCircle}>
              <Text style={{ fontSize: 26 }}>⭐</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.balanceLabel}>{t("rewards.soldeLabel")}</Text>
              <Text style={styles.balanceValue}>
                {balanceFor(selectedChild.id)}{" "}
                <Text style={styles.balanceUnit}>
                  {t(unitShortKey(unitKindFor(selectedChild.id)))}
                </Text>
              </Text>
            </View>
            <View style={styles.balanceCta}>
              <Text style={styles.balanceCtaText}>{t("parentDash.rewards")} ›</Text>
            </View>
          </Pressable>
        ) : null}


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
              style={styles.kidManageCard}
            >
              <Text style={styles.statEmoji}>{child.emoji}</Text>
              <Text style={styles.kidManageName}>{child.name}</Text>
              <Text style={styles.kidManageEdit}>{t("common.edit")}</Text>
            </Pressable>
          ))}
        </View>

        {/* Spacer so last cards clear the FAB */}
        <View style={{ height: 72 }} />
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={goNewTask}
        accessibilityRole="button"
        accessibilityLabel={t("parentDash.newTask")}
        hitSlop={8}
      >
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>

      <BuildStamp />
      <ParentRewardsBottomNav navigation={navigation} active="dashboard" />

      <PhotoLightbox
        uri={lightbox?.uri ?? null}
        visible={!!lightbox}
        title={lightbox?.title}
        subtitle={lightbox?.subtitle}
        onClose={() => setLightbox(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: rewardsUi.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: { padding: 14, paddingBottom: 20 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: { flex: 1 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  sub: { color: colors.textMuted, textTransform: "capitalize", marginTop: 2 },


  chipsScroll: { marginVertical: 8, flexGrow: 0 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: rewardsUi.filterOrange, borderColor: rewardsUi.filterOrange },
  chipText: { fontWeight: "700", color: colors.text },
  chipTextActive: { color: "#fff" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  statCard: {
    minWidth: "45%",
    flexGrow: 1,
    flexBasis: "40%",
    backgroundColor: colors.card,
    borderRadius: rewardsUi.cardRadius,
    padding: 10,
    borderWidth: 0,
    alignItems: "center",
    ...rewardsUi.shadow,
  },
  statCardCompact: { paddingVertical: 8 },
  statCardSelected: {
    // M2: cream fill + shadow only — never coral/orange outline
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "#FFEFD9",
    minWidth: "100%",
    flexBasis: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  childAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    marginBottom: 2,
  },
  statEmoji: { fontSize: 28 },
  statName: { fontWeight: "700", marginTop: 4 },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.primary, marginTop: 4 },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  balanceCard: {
    ...rewardsStyles.soldeCard,
    marginBottom: 12,
  },
  balanceStarCircle: { ...rewardsStyles.soldeStarCircle },
  balanceLabel: { ...rewardsStyles.soldeLabel },
  balanceValue: { ...rewardsStyles.soldeValue },
  balanceUnit: { fontSize: 16, fontWeight: "800", color: colors.primary },
  balanceCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: rewardsUi.filterOrange,
    backgroundColor: "#fff",
  },
  balanceCtaText: { fontWeight: "800", color: rewardsUi.filterOrange, fontSize: 12 },
  section: { fontWeight: "800", fontSize: 16, marginBottom: 8, color: colors.text },
  emptyBox: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 0,
    marginBottom: 10,
    ...rewardsUi.shadow,
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
    borderWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    ...rewardsUi.shadow,
  },
  kidManageName: { fontWeight: "700", color: colors.text },
  kidManageEdit: { color: colors.primary, fontWeight: "600", fontSize: 12 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnText: { fontWeight: "700", color: colors.textMuted, fontSize: 16 },
  thumb: {
    height: 120,
    borderRadius: 12,
    marginTop: -4,
    marginBottom: 12,
    backgroundColor: colors.border,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 86,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 25,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fabPlus: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 34,
    marginTop: -2,
  },



});
