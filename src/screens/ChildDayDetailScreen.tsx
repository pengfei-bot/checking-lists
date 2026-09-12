import React, { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";
import { PrimaryButton } from "../components/PrimaryButton";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { confirmUser, notifyUser } from "../utils/feedback";
import { openPhotoReportMail } from "../utils/reportPhoto";
import { dateLocaleTag } from "../i18n";
import { formatCompletionTime, parseISODate } from "../utils/dates";
import {
  buildDayOverview,
  statusColor,
} from "../utils/calendarStatus";
import { TaskCompletion } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "ChildDayDetail">;

export function ChildDayDetailScreen({ navigation, route }: Props) {
  const { date } = route.params;
  const { t, i18n } = useTranslation();
  const { currentProfile, state, getTask, setCurrentProfileId, clearCompletionPhoto } = useApp();
  const { family } = useAuth();
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{
    uri: string;
    title?: string;
    subtitle?: string;
  } | null>(null);

  const children = useMemo(
    () => (currentProfile?.role === "child" ? [currentProfile] : []),
    [currentProfile]
  );

  const overview = useMemo(
    () => buildDayOverview(date, state.tasks, state.completions, children),
    [date, state.tasks, state.completions, children]
  );

  const completions = useMemo(() => {
    if (!currentProfile || currentProfile.role !== "child") return [] as TaskCompletion[];
    return state.completions
      .filter((c) => c.childId === currentProfile.id && c.date === date)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }, [state.completions, currentProfile, date]);

  const dateTitle = useMemo(() => {
    const d = parseISODate(date);
    return d.toLocaleDateString(dateLocaleTag(i18n.language), {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [date, i18n.language]);

  if (!currentProfile || currentProfile.role !== "child") {
    return (
      <View style={styles.center}>
        <Text>{t("roles.childRequired")}</Text>
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

  const childDay = overview.children[0];
  const statusKey = overview.status;

  const reportPhoto = (c: TaskCompletion) => {
    if (!c.photoUri) return;
    void (async () => {
      const ok = await confirmUser(
        t("photoReport.title"),
        t("photoReport.body"),
        t("photoReport.confirm")
      );
      if (!ok) return;
      setReportingId(c.id);
      try {
        await openPhotoReportMail({
          taskId: c.taskId,
          date: c.date,
          familyId: family?.id,
          completionId: c.id,
        });
        await clearCompletionPhoto(c.id);
        notifyUser(t("photoReport.doneTitle"), t("photoReport.doneBody"));
      } catch (e) {
        notifyUser(
          t("common.error"),
          e instanceof Error ? e.message : t("photoReport.failed")
        );
      } finally {
        setReportingId(null);
      }
    })();
  };


  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{dateTitle}</Text>
        <View style={styles.summaryRow}>
          <View style={[styles.badge, { backgroundColor: statusColor(statusKey) }]}>
            <Text style={styles.badgeText}>{t(`calendar.status.${statusKey}`)}</Text>
          </View>
          <Text style={styles.summaryCount}>
            {t("calendar.tasksCount", {
              done: overview.done,
              total: overview.total,
            })}
          </Text>
        </View>

        <Text style={styles.section}>{t("childHistory.completedSection")}</Text>
        {completions.length === 0 ? (
          <Text style={styles.empty}>{t("childHistory.emptyDay")}</Text>
        ) : (
          completions.map((c) => {
            const task = getTask(c.taskId);
            const title = task?.title ?? t("childHistory.taskFallback");
            const time = formatCompletionTime(c.completedAt, i18n.language);
            return (
              <View key={c.id} style={styles.row}>
                {c.photoUri ? (
                  <Pressable
                    onPress={() => {
                      const parts = [dateTitle];
                      if (time) parts.push(t("common.doneAt", { time }));
                      setLightbox({
                        uri: c.photoUri!,
                        title,
                        subtitle: parts.join(" · "),
                      });
                    }}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={t("photo.viewFull")}
                    accessibilityHint={t("photo.tapToEnlarge")}
                  >
                    <Image
                      source={{ uri: c.photoUri }}
                      style={styles.thumb}
                      resizeMode="cover"
                    />
                  </Pressable>
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Text style={styles.thumbEmoji}>✅</Text>
                  </View>
                )}
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {title}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {time ? t("common.doneAt", { time }) : (task?.time ?? "")}
                    {c.photoUri ? ` · 📷` : ""}
                  </Text>
                  {c.photoUri ? (
                    <PrimaryButton
                      label={t("photoReport.button")}
                      variant="ghost"
                      loading={reportingId === c.id}
                      onPress={() => reportPhoto(c)}
                      style={{ marginTop: 8 }}
                    />
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        {childDay && childDay.total > 0 ? (
          <>
            <Text style={[styles.section, { marginTop: 20 }]}>
              {t("childHistory.planned")}
            </Text>
            {childDay.tasks.map(({ task, done }) => (
              <View
                key={task.id}
                style={[styles.planRow, done && styles.planDone]}
              >
                <Text style={styles.planCheck}>{done ? "✅" : "⬜"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planTitle, done && styles.planTitleDone]}>
                    {task.title}
                  </Text>
                  <Text style={styles.planMeta}>{task.time}</Text>
                </View>
              </View>
            ))}
          </>
        ) : null}

        <PrimaryButton
          label={t("childHistory.backCalendar")}
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
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
  root: { flex: 1, backgroundColor: colors.kidBg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  container: { padding: 16, paddingBottom: 48 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    textTransform: "capitalize",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  summaryCount: { fontWeight: "700", color: colors.textMuted },
  section: {
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 10,
    color: colors.text,
  },
  empty: { color: colors.textMuted, marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.successSoft,
  },
  thumbEmoji: { fontSize: 22 },
  rowBody: { flex: 1 },
  rowTitle: { fontWeight: "800", fontSize: 15, color: colors.text },
  rowMeta: { marginTop: 4, color: colors.textMuted, fontSize: 13 },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  planDone: { opacity: 0.85 },
  planCheck: { fontSize: 16 },
  planTitle: { fontWeight: "700", color: colors.text },
  planTitleDone: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  planMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
