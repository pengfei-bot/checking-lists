import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import { PrimaryButton } from "../components/PrimaryButton";
import { BuildStamp } from "../components/BuildStamp";
import { frenchCloudError } from "../utils/cloudTimeout";
import { notifyUser } from "../utils/feedback";
import { RewardUnitKind } from "../types";
import { unitShortKey } from "../utils/rewards";
import { ParentRewardsBottomNav } from "../components/RewardsBottomNav";

type Props = NativeStackScreenProps<RootStackParamList, "Rewards">;

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
  } = useApp();

  const [saving, setSaving] = useState(false);
  /** Per-child accordion — collapsed by default so the header affordance is obvious. */
  const [expandedByChild, setExpandedByChild] = useState<Record<string, boolean>>({});

  // Heal missing per-child rows when opening Rewards (new kids / pre-backfill families).
  useEffect(() => {
    void ensureMissingChildRewardSettings();
  }, [ensureMissingChildRewardSettings, childrenProfiles.length]);

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

  const toggleChildExpanded = (childId: string) => {
    setExpandedByChild((prev) => ({ ...prev, [childId]: !prev[childId] }));
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

  return (
    <View style={styles.root}>
      <ScrollView
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

                <View style={styles.tipBanner}>
                  <Text style={styles.tipBannerIcon}>💡</Text>
                  <Text style={styles.tipBannerText}>{t("rewards.pointsOnTaskTip")}</Text>
                </View>

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

        <View style={styles.pointsTipCard}>
          <Text style={styles.section}>{t("rewards.configurePoints")}</Text>
          <Text style={styles.help}>{t("rewards.configurePointsHelp")}</Text>
        </View>

        <BuildStamp />
        <View style={{ height: 72 }} />
      </ScrollView>

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
  section: {
    fontWeight: "800",
    fontSize: 16,
    marginTop: 4,
    marginBottom: 8,
    color: rewardsUi.navy,
  },
  help: { color: colors.textMuted, fontSize: 13, marginTop: 2, marginBottom: 6 },
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
  expandHint: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "600",
    color: rewardsUi.navyMuted,
  },
  tipBanner: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: rewardsUi.pillRadius,
    borderWidth: 1,
    borderColor: "#F0E0D0",
    backgroundColor: "#FFF9F3",
  },
  tipBannerIcon: { fontSize: 14, marginTop: 1 },
  tipBannerText: {
    flex: 1,
    fontWeight: "600",
    color: rewardsUi.navyMuted,
    fontSize: 13,
    lineHeight: 18,
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
  pointsTipCard: {
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: colors.card,
    borderRadius: rewardsUi.cardRadius,
    borderWidth: 1,
    borderColor: "#F0E0D0",
    padding: 14,
    ...rewardsUi.shadow,
  },
});
