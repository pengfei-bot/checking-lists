import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";
import { PrimaryButton } from "../components/PrimaryButton";
import { formatCompletionTime, formatLocalizedDate } from "../utils/dates";
import { buildDayOverview, statusColor } from "../utils/calendarStatus";

type Props = NativeStackScreenProps<RootStackParamList, "ParentDayDetail">;

export function ParentDayDetailScreen({ navigation, route }: Props) {
  const { date } = route.params;
  const { t, i18n } = useTranslation();
  const { childrenProfiles, state, currentProfile, setCurrentProfileId } = useApp();

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
            navigation.replace("ProfilePicker");
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
                  return (
                    <Pressable
                      key={task.id}
                      onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                      style={[styles.taskRow, done && styles.taskDone]}
                    >
                      <Text style={styles.taskCheck}>{done ? "✅" : "⬜"}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.taskTitle, done && styles.taskTitleDone]}>{task.title}</Text>
                        <Text style={styles.taskMeta}>{metaParts.join(" · ")}</Text>
                      </View>
                      <Text style={styles.taskLink}>{t("calendar.detailLink")}</Text>
                    </Pressable>
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
  taskTitle: { fontWeight: "700", color: colors.text },
  taskTitleDone: { textDecorationLine: "line-through", color: colors.textMuted },
  taskMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  taskLink: { color: colors.primary, fontWeight: "700", fontSize: 12 },
});
