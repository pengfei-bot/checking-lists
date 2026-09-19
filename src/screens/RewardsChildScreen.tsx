import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { rewardsStyles, rewardsUi } from "../theme/rewardsUi";
import { RootStackParamList } from "../navigation/types";
import { PrimaryButton } from "../components/PrimaryButton";
import { frenchCloudError } from "../utils/cloudTimeout";
import { formatCompletionTime, formatLocalizedDate } from "../utils/dates";
import { confirmUser, notifyUser } from "../utils/feedback";
import { RewardUnitKind } from "../types";
import { unitShortKey } from "../utils/rewards";

type Props = NativeStackScreenProps<RootStackParamList, "RewardsChild">;

export function RewardsChildScreen({ navigation, route }: Props) {
  const { childId } = route.params;
  const { t, i18n } = useTranslation();
  const {
    getProfile,
    getTask,
    balanceFor,
    ledgerByChild,
    unitKindFor,
    setChildUnitKind,
    isRewardsActiveForChild,
    resetChildBalance,
    currentProfile,
  } = useApp();
  const [busy, setBusy] = useState(false);

  const child = getProfile(childId);
  const balance = balanceFor(childId);
  const entries = useMemo(() => ledgerByChild(childId), [ledgerByChild, childId]);
  const isParent = currentProfile?.role === "parent";
  const isOwnChild = currentProfile?.role === "child" && currentProfile.id === childId;
  const unitKind = unitKindFor(childId);
  const unitLabel = t(unitShortKey(unitKind));
  const childActive = isRewardsActiveForChild(childId);

  if (!child || child.role !== "child") {
    return (
      <View style={styles.center}>
        <Text>{t("rewards.childNotFound")}</Text>
        <PrimaryButton label={t("common.back")} onPress={() => navigation.goBack()} style={{ marginTop: 12 }} />
      </View>
    );
  }

  if (!isParent && !isOwnChild) {
    return (
      <View style={styles.center}>
        <Text>{t("roles.parentOnly")}</Text>
        <PrimaryButton label={t("common.back")} onPress={() => navigation.goBack()} style={{ marginTop: 12 }} />
      </View>
    );
  }

  if (isOwnChild && !childActive) {
    return (
      <View style={styles.center}>
        <Text style={{ textAlign: "center" }}>{t("rewards.disabledHintChild")}</Text>
        <PrimaryButton label={t("common.back")} onPress={() => navigation.goBack()} style={{ marginTop: 12 }} />
      </View>
    );
  }

  const onReset = () => {
    void (async () => {
      if (balance <= 0) {
        notifyUser(t("rewards.resetTitle"), t("rewards.resetEmpty"));
        return;
      }
      const ok = await confirmUser(
        t("rewards.resetTitle"),
        t("rewards.resetBody", { name: child.name, balance, unit: unitLabel }),
        t("rewards.resetConfirm")
      );
      if (!ok) return;
      setBusy(true);
      try {
        await resetChildBalance(childId);
        notifyUser(t("rewards.resetDoneTitle"), t("rewards.resetDoneBody"));
      } catch (e) {
        notifyUser(t("common.error"), frenchCloudError(e, t("rewards.resetFailed")));
      } finally {
        setBusy(false);
      }
    })();
  };

  const kindLabel = (kind: string) => {
    if (kind === "earn") return t("rewards.kindEarn");
    if (kind === "reset") return t("rewards.kindReset");
    return t("rewards.kindAdjust");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>
        {isOwnChild ? t("rewards.myHistory") : `${child.emoji} ${child.name}`}
      </Text>

      <View style={styles.soldeCard}>
        <View style={styles.soldeStarCircle}>
          <Text style={styles.soldeStar}>⭐</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.soldeLabel}>{t("rewards.currentBalanceLabel")}</Text>
          <Text style={styles.soldeValue}>
            {balance} <Text style={styles.soldeUnit}>{unitLabel}</Text>
          </Text>
        </View>
        <Text style={styles.soldeDecor}>✨</Text>
      </View>

      {!childActive && isParent ? (
        <Text style={styles.help}>{t("rewards.disabledHint")}</Text>
      ) : null}

      {isParent ? (
        <View style={styles.unitBlock}>
          <Text style={styles.unitLabel}>{t("rewards.unitKind")}</Text>
          <View style={rewardsStyles.unitSeg}>
            {(["points", "money"] as RewardUnitKind[]).map((kind) => (
              <Pressable
                key={kind}
                disabled={busy}
                onPress={() => {
                  void (async () => {
                    if (unitKind === kind) return;
                    setBusy(true);
                    try {
                      await setChildUnitKind(childId, kind);
                    } catch (e) {
                      notifyUser(t("common.error"), frenchCloudError(e, t("rewards.saveFailed")));
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
                style={[
                  rewardsStyles.unitSegItem,
                  unitKind === kind && rewardsStyles.unitSegItemActive,
                ]}
              >
                <Text
                  style={[
                    rewardsStyles.unitSegText,
                    unitKind === kind && rewardsStyles.unitSegTextActive,
                  ]}
                >
                  {kind === "points" ? t("rewards.unitPoints") : t("rewards.unitMoney")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {isParent ? (
        <PrimaryButton
          label={t("rewards.resetButton")}
          variant="danger"
          onPress={onReset}
          loading={busy}
          style={{ marginTop: 16 }}
        />
      ) : null}

      <Text style={styles.section}>{t("rewards.history")}</Text>
      {entries.length === 0 ? (
        <Text style={styles.help}>{t("rewards.historyEmpty")}</Text>
      ) : (
        <View style={styles.timeline}>
          {entries.map((entry, index) => {
            const task = entry.taskId ? getTask(entry.taskId) : undefined;
            const day = entry.createdAt.slice(0, 10);
            const time = formatCompletionTime(entry.createdAt, i18n.language);
            const amountStr =
              entry.amount > 0 ? `+${entry.amount}` : String(entry.amount);
            const isReset = entry.kind === "reset";
            const isLast = index === entries.length - 1;
            return (
              <View key={entry.id} style={styles.timelineItem}>
                <View style={styles.timelineRail}>
                  <View
                    style={[
                      rewardsStyles.timelineDot,
                      isReset
                        ? rewardsStyles.timelineDotReset
                        : rewardsStyles.timelineDotEarn,
                    ]}
                  >
                    <Text style={rewardsStyles.timelineDotText}>
                      {isReset ? "↺" : "✓"}
                    </Text>
                  </View>
                  {!isLast ? <View style={styles.timelineLine} /> : null}
                </View>
                <View
                  style={[
                    styles.row,
                    isReset ? rewardsStyles.resetRow : rewardsStyles.earnRow,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    {!isReset ? (
                      <Text
                        style={[
                          styles.earnAmount,
                          entry.amount < 0 && styles.amountNeg,
                        ]}
                      >
                        {amountStr} {unitLabel}
                      </Text>
                    ) : null}
                    <Text style={styles.rowTitle}>
                      {isReset
                        ? kindLabel(entry.kind)
                        : task
                          ? task.title
                          : kindLabel(entry.kind)}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {formatLocalizedDate(day, i18n.language)} · {time}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </Text>
                  </View>
                  <Text style={styles.resetIcon}>{isReset ? "🗑️" : "✨"}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <PrimaryButton
        label={t("common.back")}
        variant="ghost"
        onPress={() => navigation.goBack()}
        style={{ marginTop: 16 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: { ...rewardsStyles.screenHistory },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 14,
  },
  soldeCard: {
    ...rewardsStyles.soldePurpleCard,
    marginBottom: 8,
  },
  soldeStarCircle: { ...rewardsStyles.soldePurpleStarCircle },
  soldeStar: { fontSize: 26 },
  soldeLabel: { fontSize: 13, fontWeight: "700", color: colors.text },
  soldeValue: { ...rewardsStyles.soldePurpleValue },
  soldeUnit: { fontSize: 18, fontWeight: "800", color: rewardsUi.purpleDeep },
  soldeDecor: { fontSize: 22 },
  help: { color: colors.textMuted, textAlign: "center", marginTop: 8 },
  section: { fontWeight: "800", fontSize: 16, marginTop: 24, marginBottom: 12, color: colors.text },
  timeline: { paddingLeft: 2 },
  timelineItem: { flexDirection: "row", alignItems: "stretch", gap: 10, marginBottom: 10 },
  timelineRail: { width: 22, alignItems: "center" },
  timelineLine: {
    flex: 1,
    width: 2,
    marginTop: 4,
    backgroundColor: "#D1D5DB",
    borderStyle: "dashed",
    minHeight: 12,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  earnAmount: {
    fontWeight: "800",
    fontSize: 15,
    color: colors.success,
    marginBottom: 2,
  },
  rowTitle: { fontWeight: "700", color: colors.text },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  amountNeg: { color: colors.danger },
  resetIcon: { fontSize: 18 },
  unitBlock: { marginTop: 14, alignItems: "flex-start", gap: 6 },
  unitLabel: { fontWeight: "700", fontSize: 12, color: colors.textMuted },
});
