import React, { useMemo, useState } from "react";
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
import { RootStackParamList } from "../navigation/types";
import { useParentOnlyGuard } from "../navigation/useParentOnlyGuard";
import { PrimaryButton } from "../components/PrimaryButton";
import { frenchCloudError } from "../utils/cloudTimeout";
import { notifyUser } from "../utils/feedback";
import { RewardUnitKind } from "../types";
import { unitShortKey } from "../utils/rewards";

type Props = NativeStackScreenProps<RootStackParamList, "Rewards">;

export function RewardsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const blocked = useParentOnlyGuard(navigation);
  const {
    childrenProfiles,
    currentProfile,
    setCurrentProfileId,
    rewardsEnabled,
    balanceFor,
    updateRewardSettings,
    setChildUnitKind,
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

  const tasksSorted = useMemo(
    () =>
      state.tasks
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title) || a.time.localeCompare(b.time)),
    [state.tasks]
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

  const onToggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      await updateRewardSettings({ enabled });
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
      await setChildUnitKind(childId, kind);
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
      notifyUser(t("rewards.savedTitle"), t("rewards.pointsSaved"));
    } catch (e) {
      notifyUser(t("common.error"), frenchCloudError(e, t("rewards.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t("rewards.title")}</Text>
      <Text style={styles.sub}>{t("rewards.subtitle")}</Text>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t("rewards.enabled")}</Text>
            <Text style={styles.help}>{t("rewards.enabledHelp")}</Text>
          </View>
          <Switch
            value={rewardsEnabled}
            onValueChange={(v) => void onToggle(v)}
            disabled={saving}
          />
        </View>
      </View>

      {rewardsEnabled ? (
        <View style={styles.pendingCard}>
          <Text style={styles.pendingTitle}>
            {t("rewards.toValidate")}
            {pendingEarns.length > 0 ? ` (${pendingEarns.length})` : ""}
          </Text>
          {pendingEarns.length === 0 ? (
            <Text style={styles.help}>{t("rewards.toValidateEmpty")}</Text>
          ) : (
            pendingEarns.map((item) => {
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

      <Text style={styles.section}>{t("rewards.balances")}</Text>
      <Text style={styles.help}>{t("rewards.unitPerChildHelp")}</Text>
      {childrenProfiles.length === 0 ? (
        <Text style={[styles.help, { marginTop: 8 }]}>{t("rewards.noChildren")}</Text>
      ) : (
        childrenProfiles.map((child) => {
          const bal = balanceFor(child.id);
          const kind = unitKindFor(child.id);
          const unit = t(unitShortKey(kind));
          return (
            <View key={child.id} style={[styles.childCard, { borderColor: child.color }]}>
              <Pressable
                onPress={() => navigation.navigate("RewardsChild", { childId: child.id })}
                style={styles.childRow}
              >
                <Text style={styles.childEmoji}>{child.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.childName}>{child.name}</Text>
                  <Text style={styles.childMeta}>{t("rewards.tapHistory")}</Text>
                </View>
                <Text style={styles.balance}>
                  {bal} {unit}
                </Text>
              </Pressable>
              <View style={styles.unitRow}>
                <Text style={styles.unitLabel}>{t("rewards.unitKind")}</Text>
                <View style={styles.chips}>
                  <Pressable
                    onPress={() => void onUnitKind(child.id, "points")}
                    disabled={saving}
                    style={[styles.unitChip, kind === "points" && styles.unitChipActive]}
                  >
                    <Text
                      style={[
                        styles.unitChipText,
                        kind === "points" && styles.unitChipTextActive,
                      ]}
                    >
                      {t("rewards.unitPoints")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void onUnitKind(child.id, "money")}
                    disabled={saving}
                    style={[styles.unitChip, kind === "money" && styles.unitChipActive]}
                  >
                    <Text
                      style={[
                        styles.unitChipText,
                        kind === "money" && styles.unitChipTextActive,
                      ]}
                    >
                      {t("rewards.unitMoney")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })
      )}

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
          return (
            <View key={task.id} style={styles.taskRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.childMeta}>
                  {child ? `${child.emoji} ${child.name}` : "—"} · {task.time}
                </Text>
              </View>
              <TextInput
                value={draft}
                onChangeText={(v) => setPointsDraft((p) => ({ ...p, [task.id]: v }))}
                keyboardType="number-pad"
                style={styles.pointsInput}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
              <Pressable
                onPress={() => void onSavePoints(task.id)}
                style={styles.savePts}
                disabled={saving}
              >
                <Text style={styles.savePtsText}>{t("common.save")}</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: { padding: 16, paddingBottom: 48, backgroundColor: colors.parentBg },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  sub: { color: colors.textMuted, marginTop: 4, marginBottom: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  pendingCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: 16,
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
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { fontWeight: "700", color: colors.text },
  help: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  section: { fontWeight: "800", fontSize: 16, marginTop: 8, marginBottom: 8, color: colors.text },
  childCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 2,
    padding: 12,
    marginBottom: 10,
  },
  childRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  childEmoji: { fontSize: 28 },
  childName: { fontWeight: "800", color: colors.text },
  childMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  balance: { fontWeight: "800", fontSize: 18, color: colors.primary },
  unitRow: { marginTop: 10, gap: 6 },
  unitLabel: { fontWeight: "700", fontSize: 12, color: colors.textMuted },
  chips: { flexDirection: "row", gap: 8 },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  unitChipText: { fontWeight: "700", color: colors.text, fontSize: 13 },
  unitChipTextActive: { color: colors.primary },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginTop: 8,
  },
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
});
