import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useApp } from "../context/AppContext";
import { colors, softTint } from "../theme/colors";
import { rewardsStyles, rewardsUi } from "../theme/rewardsUi";
import { RootStackParamList } from "../navigation/types";
import { useParentOnlyGuard } from "../navigation/useParentOnlyGuard";
import { PrimaryButton } from "../components/PrimaryButton";
import { BuildStamp } from "../components/BuildStamp";
import { frenchCloudError } from "../utils/cloudTimeout";
import { notifyUser } from "../utils/feedback";
import { RewardUnitKind } from "../types";
import { unitShortKey } from "../utils/rewards";
import { ParentRewardsBottomNav } from "../components/RewardsBottomNav";

type Props = NativeStackScreenProps<RootStackParamList, "Rewards">;
type ChildFilter = string | "all";

export function RewardsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const blocked = useParentOnlyGuard(navigation);
  const {
    childrenProfiles,
    currentProfile,
    setCurrentProfileId,
    balanceFor,
    upsertChildRewardSettings,
    ensureMissingChildRewardSettings,
    isRewardsActiveForChild,
    unitKindFor,
    state,
    pointsFor,
    setTaskPoints,
    pendingEarns,
    validateEarn,
    getProfile,
  } = useApp();

  const [saving, setSaving] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [pointsDraft, setPointsDraft] = useState<Record<string, string>>({});
  const [filterChildId, setFilterChildId] = useState<ChildFilter>("all");
  const [pendingOpen, setPendingOpen] = useState(false);
  /** Per-child accordion — collapsed by default so the header affordance is obvious. */
  const [expandedByChild, setExpandedByChild] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<ScrollView>(null);
  const pointsYRef = useRef(0);

  // Heal missing per-child rows when opening Rewards (new kids / pre-backfill families).
  useEffect(() => {
    void ensureMissingChildRewardSettings();
  }, [ensureMissingChildRewardSettings, childrenProfiles.length]);

  const tasksSorted = useMemo(() => {
    return state.tasks
      .filter((task) => filterChildId === "all" || task.childId === filterChildId)
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title) || a.time.localeCompare(b.time));
  }, [state.tasks, filterChildId]);

  const filteredPending = useMemo(
    () =>
      pendingEarns.filter(
        (item) => filterChildId === "all" || item.childId === filterChildId
      ),
    [pendingEarns, filterChildId]
  );

  const pendingCountByChild = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of pendingEarns) {
      map[item.childId] = (map[item.childId] ?? 0) + 1;
    }
    return map;
  }, [pendingEarns]);

  // Auto-expand hub only when there is something to validate (still below fold).
  useEffect(() => {
    if (filteredPending.length > 0) setPendingOpen(true);
  }, [filteredPending.length]);

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

  const unitLabelFor = (childId: string) => t(unitShortKey(unitKindFor(childId)));

  const setChildExpanded = (childId: string, open: boolean) => {
    setExpandedByChild((prev) => ({ ...prev, [childId]: open }));
  };

  const toggleChildExpanded = (childId: string) => {
    setExpandedByChild((prev) => ({ ...prev, [childId]: !prev[childId] }));
  };

  /** Expand card + filter task points to this child + scroll to config list. */
  const onConfigureChild = (childId: string) => {
    setChildExpanded(childId, true);
    setFilterChildId(childId);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, pointsYRef.current - 12),
        animated: true,
      });
    });
  };

  const onToggleChild = async (childId: string, enabled: boolean) => {
    setSaving(true);
    try {
      await upsertChildRewardSettings(childId, { enabled });
    } catch (e) {
      notifyUser(t("common.error"), frenchCloudError(e, t("rewards.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  const onUnitKind = async (childId: string, kind: RewardUnitKind) => {
    if (unitKindFor(childId) === kind) return;
    setSaving(true);
    try {
      await upsertChildRewardSettings(childId, { unitKind: kind });
    } catch (e) {
      notifyUser(t("common.error"), frenchCloudError(e, t("rewards.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  const onValidatePending = async (item: (typeof pendingEarns)[number]) => {
    setValidatingId(item.completionId);
    try {
      const entry = await validateEarn(item.taskId, item.childId, item.completionId);
      if (!entry) {
        notifyUser(t("rewards.validateTitle"), t("rewards.noPointsConfigured"));
        return;
      }
      notifyUser(
        t("rewards.validateTitle"),
        t("rewards.validateDone", {
          amount: entry.amount,
          unit: unitLabelFor(item.childId),
        })
      );
    } catch (e) {
      notifyUser(t("common.error"), frenchCloudError(e, t("rewards.validateFailed")));
    } finally {
      setValidatingId(null);
    }
  };

  const onSavePoints = async (taskId: string) => {
    const raw = pointsDraft[taskId];
    const n = raw === undefined || raw.trim() === "" ? null : Number(raw);
    if (n != null && (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n)) {
      notifyUser(t("common.error"), t("rewards.pointsInvalid"));
      return;
    }
    setSaving(true);
    try {
      await setTaskPoints(taskId, n === 0 ? null : n);
      setPointsDraft((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    } catch (e) {
      notifyUser(t("common.error"), frenchCloudError(e, t("rewards.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  const onSaveAll = async () => {
    const ids = Object.keys(pointsDraft);
    setSaving(true);
    try {
      for (const taskId of ids) {
        const raw = pointsDraft[taskId];
        const n = raw === undefined || raw.trim() === "" ? null : Number(raw);
        if (n != null && (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n)) {
          notifyUser(t("common.error"), t("rewards.pointsInvalid"));
          return;
        }
        await setTaskPoints(taskId, n === 0 || n == null ? null : n);
      }
      setPointsDraft({});
      notifyUser(t("rewards.savedTitle"), t("rewards.savedBody"));
    } catch (e) {
      notifyUser(t("common.error"), frenchCloudError(e, t("rewards.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  const filterChips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
      <Pressable
        onPress={() => setFilterChildId("all")}
        style={[
          rewardsStyles.filterChip,
          filterChildId === "all" && rewardsStyles.filterChipActive,
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
      {childrenProfiles.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => setFilterChildId(c.id)}
          style={[
            rewardsStyles.filterChip,
            filterChildId === c.id && rewardsStyles.filterChipActive,
          ]}
        >
          <Text
            style={[
              rewardsStyles.filterChipText,
              filterChildId === c.id && rewardsStyles.filterChipTextActive,
            ]}
          >
            {c.emoji} {c.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.section}>{t("rewards.perChild")}</Text>
        {childrenProfiles.length === 0 ? (
          <Text style={styles.help}>{t("rewards.noChildrenHelp")}</Text>
        ) : (
          childrenProfiles.map((child) => {
            const active = isRewardsActiveForChild(child.id);
            const kind = unitKindFor(child.id);
            const bal = balanceFor(child.id);
            const unit = t(unitShortKey(kind));
            const expanded = !!expandedByChild[child.id];
            const pendingCount = pendingCountByChild[child.id] ?? 0;
            return (
              <View
                key={child.id}
                style={[
                  styles.childCard,
                  expanded && styles.childCardExpanded,
                ]}
              >
                <View style={styles.childHeader}>
                  <Pressable
                    onPress={() => toggleChildExpanded(child.id)}
                    style={styles.childIdentity}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityLabel={`${child.name}. ${
                      expanded ? t("rewards.tapToCollapse") : t("rewards.tapToExpand")
                    }`}
                  >
                    <Text style={styles.childChevron} accessibilityElementsHidden>
                      {expanded ? "▼" : "▶"}
                    </Text>
                    <View
                      style={[
                        rewardsStyles.avatarCircle,
                        {
                          backgroundColor: softTint(child.color || colors.primary, 0.2),
                          borderColor: child.color || colors.primary,
                          borderWidth: 2,
                        },
                      ]}
                    >
                      <Text style={rewardsStyles.avatarEmoji}>{child.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.childName}>
                        {child.name} {child.emoji}
                      </Text>
                      <Text style={styles.sectionLabel}>{t("rewards.childSectionLabel")}</Text>
                      <Text
                        style={[styles.statusLabel, active ? styles.statusOn : styles.statusOff]}
                      >
                        {active ? t("rewards.activated") : t("rewards.deactivated")}
                        {active
                          ? ` · ${t("rewards.soldeChip", { amount: bal, unit })}`
                          : ""}
                      </Text>
                      {pendingCount > 0 ? (
                        <Text style={styles.pendingBadgeText}>
                          {t("rewards.pendingForChild", { count: pendingCount })}
                        </Text>
                      ) : null}
                      <Text style={styles.expandHint}>
                        {expanded ? t("rewards.tapToCollapse") : t("rewards.tapToExpand")}
                      </Text>
                    </View>
                  </Pressable>
                  <Switch
                    value={active}
                    onValueChange={(v) => void onToggleChild(child.id, v)}
                    disabled={saving}
                    trackColor={{ false: "#D1D5DB", true: colors.success }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor="#D1D5DB"
                    accessibilityLabel={
                      active ? t("rewards.activated") : t("rewards.deactivated")
                    }
                  />
                </View>

                <Pressable
                  onPress={() => onConfigureChild(child.id)}
                  style={styles.configureCta}
                  accessibilityRole="button"
                  accessibilityLabel={t("rewards.configureCta")}
                >
                  <Text style={styles.configureCtaIcon}>⚙️</Text>
                  <Text style={styles.configureCtaText}>{t("rewards.configureCta")}</Text>
                </Pressable>

                {expanded ? (
                  <View style={styles.childBody}>
                    <Text style={styles.unitRowLabel}>{t("rewards.unitRowLabel")}</Text>
                    <View style={[styles.unitRow, !active && styles.unitRowDisabled]}>
                      <View style={rewardsStyles.unitSeg}>
                        <Pressable
                          onPress={() => void onUnitKind(child.id, "points")}
                          disabled={saving || !active}
                          style={[
                            rewardsStyles.unitSegItem,
                            kind === "points" && active && rewardsStyles.unitSegItemActive,
                          ]}
                        >
                          <Text
                            style={[
                              rewardsStyles.unitSegText,
                              kind === "points" && active && rewardsStyles.unitSegTextActive,
                            ]}
                          >
                            {t("rewards.unitPoints")} ⭐
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void onUnitKind(child.id, "money")}
                          disabled={saving || !active}
                          style={[
                            rewardsStyles.unitSegItem,
                            kind === "money" && active && rewardsStyles.unitSegItemActive,
                          ]}
                        >
                          <Text
                            style={[
                              rewardsStyles.unitSegText,
                              kind === "money" && active && rewardsStyles.unitSegTextActive,
                            ]}
                          >
                            {t("rewards.unitMoneyChip")}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                    <Pressable
                      onPress={() =>
                        navigation.navigate("RewardsChild", { childId: child.id })
                      }
                      style={styles.historyLink}
                      accessibilityRole="link"
                    >
                      <Text style={styles.historyLinkText}>
                        {t("rewards.openChildHistory")} →
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        <View style={rewardsStyles.infoBanner}>
          <View style={rewardsStyles.infoBannerIcon}>
            <Text style={rewardsStyles.infoBannerIconText}>i</Text>
          </View>
          <Text style={rewardsStyles.infoBannerText}>{t("rewards.parentOnlyActivate")}</Text>
        </View>

        {filterChips}

        <View
          onLayout={(e) => {
            pointsYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.section}>{t("rewards.configurePoints")}</Text>
          <Text style={styles.help}>{t("rewards.configurePointsHelp")}</Text>
          {tasksSorted.length === 0 ? (
            <Text style={styles.help}>{t("rewards.noTasks")}</Text>
          ) : (
            tasksSorted.map((task) => {
              const child = childrenProfiles.find((c) => c.id === task.childId);
              const current = pointsFor(task.id);
              const draft =
                pointsDraft[task.id] !== undefined
                  ? pointsDraft[task.id]
                  : current != null
                    ? String(current)
                    : "";
              const childActive = child ? isRewardsActiveForChild(child.id) : false;
              return (
                <View key={task.id} style={[styles.taskRow, !childActive && styles.taskRowMuted]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.childMeta}>
                      {child ? `${child.emoji} ${child.name}` : "—"} · {task.time}
                      {!childActive ? ` · ${t("rewards.deactivated")}` : ""}
                    </Text>
                  </View>
                  {current != null && childActive ? (
                    <View style={[rewardsStyles.pointsPill, { marginRight: 4 }]}>
                      <Text style={rewardsStyles.pointsPillText}>+{current} ⭐</Text>
                    </View>
                  ) : null}
                  <TextInput
                    value={draft}
                    onChangeText={(v) => setPointsDraft((p) => ({ ...p, [task.id]: v }))}
                    keyboardType="number-pad"
                    style={styles.pointsInput}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    editable={childActive}
                  />
                  <Pressable
                    onPress={() => void onSavePoints(task.id)}
                    style={styles.savePts}
                    disabled={saving || !childActive}
                  >
                    <Text style={styles.savePtsText}>{t("common.save")}</Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        {/* « À valider » hub below the fold — collapsed when empty */}
        <Pressable
          onPress={() => setPendingOpen((v) => !v)}
          style={styles.pendingHeader}
          accessibilityRole="button"
        >
          <Text style={styles.pendingTitle}>
            {t("rewards.toValidate")}
            {filteredPending.length > 0 ? ` (${filteredPending.length})` : ""}
          </Text>
          <Text style={styles.pendingChevron}>{pendingOpen ? "▼" : "▶"}</Text>
        </Pressable>
        {pendingOpen ? (
          <View style={styles.pendingCard}>
            {filteredPending.length === 0 ? (
              <Text style={styles.help}>{t("rewards.toValidateEmpty")}</Text>
            ) : (
              filteredPending.map((item) => {
                const child = getProfile(item.childId);
                const unit = unitLabelFor(item.childId);
                return (
                  <View key={item.completionId} style={styles.pendingRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskTitle}>{item.taskTitle}</Text>
                      <Text style={styles.childMeta}>
                        {child ? `${child.emoji} ${child.name}` : "—"} · +{item.points} {unit}
                      </Text>
                    </View>
                    <PrimaryButton
                      label={t("rewards.validatePendingCta")}
                      onPress={() => void onValidatePending(item)}
                      loading={validatingId === item.completionId}
                      style={styles.validateBtn}
                    />
                  </View>
                );
              })
            )}
          </View>
        ) : null}

        <BuildStamp />
        <View style={{ height: 72 }} />
      </ScrollView>

      <View style={styles.stickyBar}>
        <PrimaryButton
          label={t("rewards.saveSettings")}
          onPress={() => void onSaveAll()}
          loading={saving}
          style={styles.saveBtn}
        />
      </View>
      <ParentRewardsBottomNav navigation={navigation} active="rewards" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: rewardsUi.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: {
    ...rewardsStyles.screenParent,
    backgroundColor: rewardsUi.cream,
  },
  stickyBar: {
    ...rewardsStyles.stickyBar,
    backgroundColor: rewardsUi.cream,
    paddingBottom: Platform.OS === "ios" ? 20 : 12,
  },
  section: {
    fontWeight: "800",
    fontSize: 16,
    marginTop: 4,
    marginBottom: 8,
    color: rewardsUi.navy,
  },
  help: { color: colors.textMuted, fontSize: 13, marginTop: 2, marginBottom: 6 },
  pendingHeader: {
    marginTop: 16,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pendingTitle: { fontWeight: "800", fontSize: 16, color: rewardsUi.navy },
  pendingChevron: { fontSize: 14, color: colors.textMuted, fontWeight: "700" },
  pendingCard: {
    backgroundColor: colors.card,
    borderRadius: rewardsUi.cardRadius,
    padding: 12,
    borderWidth: 0,
    marginBottom: 8,
    ...rewardsUi.shadow,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  validateBtn: { paddingHorizontal: 12, minWidth: 96 },
  childCard: {
    backgroundColor: colors.card,
    borderRadius: rewardsUi.cardRadius,
    borderWidth: 1.5,
    borderColor: "#F0E0D0",
    padding: 14,
    marginBottom: 12,
    ...rewardsUi.shadow,
  },
  childCardExpanded: {
    borderColor: rewardsUi.peach,
    backgroundColor: rewardsUi.peachSoft,
  },
  childHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  childIdentity: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
  childChevron: {
    fontSize: 12,
    color: rewardsUi.navyMuted,
    fontWeight: "800",
    marginTop: 16,
    width: 14,
  },
  childName: { fontWeight: "800", color: rewardsUi.navy, fontSize: 16 },
  sectionLabel: {
    fontWeight: "700",
    fontSize: 12,
    color: rewardsUi.navyMuted,
    marginTop: 1,
    letterSpacing: 0.2,
  },
  statusLabel: { fontWeight: "700", fontSize: 13, marginTop: 2 },
  statusOn: { color: colors.success },
  statusOff: { color: colors.textMuted },
  pendingBadgeText: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "800",
    color: rewardsUi.filterOrange,
  },
  expandHint: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "600",
    color: rewardsUi.navyMuted,
  },
  configureCta: {
    marginTop: 10,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: rewardsUi.pillRadius,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "#fff",
  },
  configureCtaIcon: { fontSize: 14 },
  configureCtaText: {
    fontWeight: "800",
    color: colors.primary,
    fontSize: 14,
  },
  childBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0E0D0",
  },
  unitRowLabel: {
    fontWeight: "700",
    fontSize: 12,
    color: rewardsUi.navyMuted,
    marginBottom: 6,
  },
  unitRow: { marginTop: 0 },
  unitRowDisabled: { opacity: 0.4 },
  historyLink: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  historyLinkText: {
    fontWeight: "800",
    color: colors.primary,
    fontSize: 13,
  },
  childMeta: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  chipsScroll: { marginBottom: 10, flexGrow: 0 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 0,
    padding: 10,
    marginTop: 8,
    ...rewardsUi.shadow,
  },
  taskRowMuted: { opacity: 0.55 },
  taskTitle: { fontWeight: "700", color: colors.text },
  pointsInput: {
    width: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
    textAlign: "center",
    backgroundColor: colors.bg,
    color: colors.text,
    fontWeight: "700",
  },
  savePts: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
  },
  savePtsText: { fontWeight: "700", color: colors.primary, fontSize: 12 },
  saveBtn: { borderRadius: 16 },
});
