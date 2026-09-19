import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";
import { PrimaryButton } from "../components/PrimaryButton";
import { frenchCloudError } from "../utils/cloudTimeout";
import { unitShortKey } from "../utils/rewards";
import { formatCompletionTime, formatLocalizedDate } from "../utils/dates";
import { buildDayOverview, statusColor } from "../utils/calendarStatus";
import { notifyUser } from "../utils/feedback";

type Props = NativeStackScreenProps<RootStackParamList, "ParentDayDetail">;

export function ParentDayDetailScreen({ navigation, route }: Props) {
  const { date } = route.params;
  const { t, i18n } = useTranslation();
  const {
    childrenProfiles,
    state,
    currentProfile,
    setCurrentProfileId,
    isRewardsActiveForChild,
    pointsFor,
    isEarnValidated,
    validateEarn,
    unitKindFor,
  } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);

  const overview = useMemo(
    () => buildDayOverview(date, state.tasks, state.completions, childrenProfiles),
    [date, state.tasks, state.completions, childrenProfiles]
  );

  if (!currentProfile || currentProfile.role !== "parent") {
    return (
      <View style={styles.center}>
        <Text>{t("roles.parentRequired")}</Text>
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

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{formatLocalizedDate(date, i18n.language)}</Text>
        <View style={styles.summaryRow}>
          <View style={[styles.badge, { backgroundColor: statusColor(overview.status) }]}>
            <Text style={styles.badgeText}>{t(`calendar.status.${overview.status}`)}</Text>
          </View>
          <Text style={styles.summaryCount}>
            {t("calendar.tasksCount", { done: overview.done, total: overview.total })}
          </Text>
        </View>

        {overview.total === 0 ? (
          <Text style={styles.empty}>{t("calendar.noTasksDay")}</Text>
        ) : (
          overview.children.map((childDay) => {
            if (childDay.total === 0) return null;
            return (
              <View key={childDay.child.id} style={styles.childCard}>
                <View style={styles.childHeader}>
                  <Text style={styles.childTitle}>
                    {childDay.child.emoji} {childDay.child.name}
                  </Text>
                  <Text style={[styles.childCount, { color: statusColor(childDay.status) }]}>
                    {childDay.done}/{childDay.total} · {t(`calendar.status.${childDay.status}`)}
                  </Text>
                </View>
                {childDay.tasks.map(({ task, done, completion }) => {
                  const doneTime =
                    done && completion?.completedAt
                      ? formatCompletionTime(completion.completedAt, i18n.language)
                      : null;
                  const metaParts = [task.time];
                  if (doneTime) {
                    metaParts.push(t("common.doneAt", { time: doneTime }));
                  }
                  const pts = pointsFor(task.id);
                  const unitLabel = t(unitShortKey(unitKindFor(childDay.child.id)));
                  const childRewardsOn = isRewardsActiveForChild(childDay.child.id);
                  // Points badge renders next to the title (visible before validate CTA).
                  const validated = completion?.id ? isEarnValidated(completion.id) : false;
                  const canValidate =
                    !!done &&
                    !!completion?.id &&
                    isRewardsActiveForChild(childDay.child.id) &&
                    pts != null &&
                    !validated;
                  return (
                    <View key={task.id} style={[styles.taskRow, done && styles.taskDone]}>
                      <Pressable
                        onPress={() => navigation.navigate("TaskDetail", { taskId: task.id, date })}
                        style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}
                      >
                        <Text style={styles.taskCheck}>{done ? "✅" : "⬜"}</Text>
                        <View style={{ flex: 1 }}>
                          <View style={styles.titleRow}>
                            <Text style={[styles.taskTitle, done && styles.taskTitleDone]}>{task.title}</Text>
                            {childRewardsOn && pts != null ? (
                              <View style={styles.pointsBadge}>
                                <Text style={styles.pointsBadgeText}>
                                  +{pts} {unitLabel}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.taskMeta}>{metaParts.join(" · ")}</Text>
                          {done && validated && pts != null ? (
                            <Text style={styles.validated}>
                              {t("rewards.alreadyValidated", { amount: pts, unit: unitLabel })}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.taskLink}>{t("calendar.detailLink")}</Text>
                      </Pressable>
                      {canValidate ? (
                        <Pressable
                          onPress={() => {
                            void (async () => {
                              setBusyId(completion!.id);
                              try {
                                const entry = await validateEarn(
                                  task.id,
                                  childDay.child.id,
                                  completion!.id
                                );
                                if (entry) {
                                  notifyUser(
                                    t("rewards.validateTitle"),
                                    t("rewards.validateDone", {
                                      amount: entry.amount,
                                      unit: unitLabel,
                                    })
                                  );
                                }
                              } catch (e) {
                                notifyUser(
                                  t("common.error"),
                                  frenchCloudError(e, t("rewards.validateFailed"))
                                );
                              } finally {
                                setBusyId(null);
                              }
                            })();
                          }}
                          style={styles.validateBtn}
                          disabled={busyId === completion?.id}
                        >
                          <Text style={styles.validateBtnText}>
                            {busyId === completion?.id
                              ? "…"
                              : t("rewards.validateCta", { amount: pts, unit: unitLabel })}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            );
          })
        )}

        <PrimaryButton
          label={t("calendar.backCalendar")}
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.parentBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, textTransform: "capitalize" },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10, marginBottom: 16 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  summaryCount: { fontWeight: "700", color: colors.textMuted },
  empty: { color: colors.textMuted, marginTop: 8 },
  childCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  childHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 6,
  },
  childTitle: { fontWeight: "800", fontSize: 16, color: colors.text },
  childCount: { fontWeight: "700", fontSize: 13 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  taskDone: { opacity: 0.85 },
  taskCheck: { fontSize: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  taskTitle: { fontWeight: "700", color: colors.text },
  pointsBadge: {
    backgroundColor: "#FFF3E0",
    borderColor: "#FFB74D",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pointsBadgeText: { fontWeight: "800", color: "#E65100", fontSize: 12 },
  taskTitleDone: { textDecorationLine: "line-through", color: colors.textMuted },
  taskMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  taskLink: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  validateBtn: {
    marginLeft: 8,
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  validateBtnText: { fontWeight: "800", color: colors.primary, fontSize: 12 },
  validated: { color: colors.success, fontSize: 11, fontWeight: "700", marginTop: 2 },
});
