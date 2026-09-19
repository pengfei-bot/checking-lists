import React, { useEffect, useMemo, useState } from "react";
import {
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
import { colors } from "../theme/colors";
import { rewardsStyles, rewardsUi } from "../theme/rewardsUi";
import { RootStackParamList } from "../navigation/types";
import { useParentOnlyGuard } from "../navigation/useParentOnlyGuard";
import { PrimaryButton } from "../components/PrimaryButton";
import { frenchCloudError } from "../utils/cloudTimeout";
import { notifyUser } from "../utils/feedback";
import { RewardUnitKind } from "../types";
import { unitShortKey } from "../utils/rewards";

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

  const unitLabelFor = (childId: string) => t(unitShortKey(unitKindFor(childId)));

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

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t("rewards.title")}</Text>
      <Text style={styles.sub}>{t("rewards.subtitleV2")}</Text>

      <Text style={styles.section}>{t("rewards.perChild")}</Text>
      <Text style={styles.help}>{t("rewards.unitPerChildHelp")}</Text>
      {childrenProfiles.length === 0 ? (
        <Text style={[styles.help, { marginTop: 8 }]}>{t("rewards.noChildrenHelp")}</Text>
      ) : (
        childrenProfiles.map((child) => {
          const active = isRewardsActiveForChild(child.id);
          const kind = unitKindFor(child.id);
          const bal = balanceFor(child.id);
          const unit = t(unitShortKey(kind));
          return (
            <View key={child.id} style={styles.childCard}>
              <View style={styles.childHeader}>
                <Pressable
                  onPress={() => navigation.navigate("RewardsChild", { childId: child.id })}
                  style={styles.childIdentity}
                >
                  <View
                    style={[
                      rewardsStyles.avatarCircle,
                      { backgroundColor: (child.color || colors.primary) + "33" },
                    ]}
                  >
                    <Text style={rewardsStyles.avatarEmoji}>{child.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.childName}>
                      {child.name} {child.emoji}
                    </Text>
                    <Text style={[styles.statusLabel, active ? styles.statusOn : styles.statusOff]}>
                      {active ? t("rewards.activated") : t("rewards.deactivated")}
                    </Text>
                    {active ? (
                      <Text style={styles.childMeta}>
                        {t("rewards.balanceLabel", { amount: bal, unit })}
                      </Text>
                    ) : null}
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
                      {t("rewards.unitPoints")}
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

      <View style={styles.pendingCard}>
        <Text style={styles.pendingTitle}>
          {t("rewards.toValidate")}
          {filteredPending.length > 0 ? ` (${filteredPending.length})` : ""}
        </Text>
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

      <Text style={styles.section}>{t("rewards.configurePoints")}</Text>
      <Text style={styles.help}>{t("rewards.configurePointsHelp")}</Text>
      {tasksSorted.length === 0 ? (
        <Text style={[styles.help, { marginTop: 8 }]}>{t("rewards.noTasks")}</Text>
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

      <PrimaryButton
        label={t("rewards.saveSettings")}
        onPress={() => void onSaveAll()}
        loading={saving}
        style={styles.saveBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: { ...rewardsStyles.screenParent },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  sub: { color: colors.textMuted, marginTop: 4, marginBottom: 14 },
  pendingCard: {
    backgroundColor: colors.card,
    borderRadius: rewardsUi.cardRadius,
    padding: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: 16,
    marginTop: 8,
    ...rewardsUi.shadow,
  },
  pendingTitle: { fontWeight: "800", fontSize: 17, color: colors.text, marginBottom: 8 },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  validateBtn: { paddingHorizontal: 12, minWidth: 96 },
  help: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  section: { fontWeight: "800", fontSize: 16, marginTop: 8, marginBottom: 8, color: colors.text },
  childCard: {
    backgroundColor: colors.card,
    borderRadius: rewardsUi.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
    ...rewardsUi.shadow,
  },
  childHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  childIdentity: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  childName: { fontWeight: "800", color: colors.text, fontSize: 16 },
  statusLabel: { fontWeight: "700", fontSize: 13, marginTop: 2 },
  statusOn: { color: colors.success },
  statusOff: { color: colors.textMuted },
  childMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  unitRow: { marginTop: 12 },
  unitRowDisabled: { opacity: 0.4 },
  chipsScroll: { marginBottom: 8, flexGrow: 0 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 8,
  },
  taskRowMuted: { opacity: 0.55 },
  taskTitle: { fontWeight: "700", color: colors.text },
  pointsInput: {
    width: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlign: "center",
    backgroundColor: colors.bg,
    color: colors.text,
    fontWeight: "700",
  },
  savePts: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
  },
  savePtsText: { fontWeight: "700", color: colors.primary, fontSize: 12 },
  saveBtn: { marginTop: 20, borderRadius: 16 },
});
