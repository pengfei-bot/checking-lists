import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
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
      <Text style={styles.emoji}>{child.emoji}</Text>
      <Text style={styles.title}>
        {isOwnChild ? t("rewards.myHistory") : child.name}
      </Text>
      <Text style={styles.balance}>
        {t("rewards.currentBalance", { amount: balance, unit: unitLabel })}
      </Text>
      {!childActive && isParent ? (
        <Text style={styles.help}>{t("rewards.disabledHint")}</Text>
      ) : null}

      {isParent ? (
        <View style={styles.unitBlock}>
          <Text style={styles.unitLabel}>{t("rewards.unitKind")}</Text>
          <View style={styles.chips}>
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
                style={[styles.unitChip, unitKind === kind && styles.unitChipActive]}
              >
                <Text
                  style={[
                    styles.unitChipText,
                    unitKind === kind && styles.unitChipTextActive,
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

      <Text style={styles.section}>{isOwnChild ? t("rewards.history") : t("rewards.history")}</Text>
      {entries.length === 0 ? (
        <Text style={styles.help}>{t("rewards.historyEmpty")}</Text>
      ) : (
        entries.map((entry) => {
          const task = entry.taskId ? getTask(entry.taskId) : undefined;
          const day = entry.createdAt.slice(0, 10);
          const time = formatCompletionTime(entry.createdAt, i18n.language);
          const amountStr =
            entry.amount > 0 ? `+${entry.amount}` : String(entry.amount);
          return (
            <View key={entry.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {kindLabel(entry.kind)}
                  {task ? ` · ${task.title}` : ""}
                </Text>
                <Text style={styles.rowMeta}>
                  {formatLocalizedDate(day, i18n.language)} · {time}
                  {entry.note ? ` · ${entry.note}` : ""}
                </Text>
              </View>
              <Text
                style={[
                  styles.amount,
                  entry.amount >= 0 ? styles.amountPos : styles.amountNeg,
                ]}
              >
                {amountStr} {unitLabel}
              </Text>
            </View>
          );
        })
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
  container: { padding: 16, paddingBottom: 48, backgroundColor: colors.bg },
  emoji: { fontSize: 48, textAlign: "center" },
  title: { fontSize: 24, fontWeight: "800", textAlign: "center", color: colors.text, marginTop: 4 },
  balance: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    color: colors.primary,
  },
  help: { color: colors.textMuted, textAlign: "center", marginTop: 8 },
  section: { fontWeight: "800", fontSize: 16, marginTop: 24, marginBottom: 8, color: colors.text },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  rowTitle: { fontWeight: "700", color: colors.text },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  amount: { fontWeight: "800", fontSize: 15 },
  amountPos: { color: colors.success },
  amountNeg: { color: colors.danger },
  unitBlock: { marginTop: 14, alignItems: "center", gap: 6 },
  unitLabel: { fontWeight: "700", fontSize: 12, color: colors.textMuted },
  chips: { flexDirection: "row", gap: 8 },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  unitChipText: { fontWeight: "700", color: colors.text, fontSize: 13 },
  unitChipTextActive: { color: colors.primary },
});
