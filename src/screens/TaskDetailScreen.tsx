import React, { useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../auth";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";
import { PrimaryButton } from "../components/PrimaryButton";
import { recurrenceLabel } from "../utils/recurrence";
import { formatCompletionTime, todayISO } from "../utils/dates";
import { confirmUser, notifyUser } from "../utils/feedback";
import { openPhotoReportMail } from "../utils/reportPhoto";
import { MOCK_PHOTO_URI, pickProofImage } from "../utils/pickImage";

type Props = NativeStackScreenProps<RootStackParamList, "TaskDetail">;

export function TaskDetailScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const {
    getTask,
    getProfile,
    completionFor,
    markTaskDone,
    unmarkTaskDone,
    clearCompletionPhoto,
    currentProfile,
  } = useApp();
  const { family } = useAuth();
  const task = getTask(route.params.taskId);
  const [busy, setBusy] = useState(false);

  if (!task) {
    return (
      <View style={styles.center}>
        <Text>{t("taskDetail.notFound")}</Text>
        <PrimaryButton label={t("common.back")} onPress={() => navigation.goBack()} style={{ marginTop: 12 }} />
      </View>
    );
  }

  const child = getProfile(task.childId);
  const done = completionFor(task.id);
  const isChild = currentProfile?.role === "child";
  const doneAtTime = done ? formatCompletionTime(done.completedAt, i18n.language) : null;

  const markDone = async (withPhoto: boolean) => {
    setBusy(true);
    try {
      let photoUri: string | undefined;
      if (withPhoto) {
        const result = await pickProofImage({ quality: 0.7, preferCamera: true });
        if (result.status === "canceled") {
          notifyUser(t("photo.title"), t("photo.canceled"));
          return;
        }
        if (result.status === "error") {
          photoUri = MOCK_PHOTO_URI;
          notifyUser(t("photo.title"), t("photo.demoUsed", { message: result.message }));
        } else {
          photoUri = result.uri;
          notifyUser(t("photo.title"), t("photo.saved"));
        }
      }
      await markTaskDone(task.id, task.childId, photoUri);
    } finally {
      setBusy(false);
    }
  };


  const reportPhoto = () => {
    if (!done?.photoUri || !done.id) return;
    void (async () => {
      const ok = await confirmUser(
        t("photoReport.title"),
        t("photoReport.body"),
        t("photoReport.confirm")
      );
      if (!ok) return;
      setBusy(true);
      try {
        await openPhotoReportMail({
          taskId: task.id,
          date: done.date,
          familyId: family?.id,
          completionId: done.id,
        });
        await clearCompletionPhoto(done.id);
        notifyUser(t("photoReport.doneTitle"), t("photoReport.doneBody"));
      } catch (e) {
        notifyUser(
          t("common.error"),
          e instanceof Error ? e.message : t("photoReport.failed")
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  if (isChild) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.statusEmoji}>{done ? "⭐" : "○"}</Text>
        <Text style={styles.childEmoji}>{child?.emoji ?? "✅"}</Text>
        <Text style={styles.childTitle}>{task.title}</Text>
        <Text style={styles.childTime}>{task.time}</Text>

        {doneAtTime ? (
          <Text style={styles.meta}>{t("taskDetail.doneAt", { time: doneAtTime })}</Text>
        ) : null}

        {done?.photoUri ? (
          <View style={styles.photoBox}>
            <Text style={styles.label}>{t("taskDetail.photoProof")}</Text>
            <Image source={{ uri: done.photoUri }} style={styles.photo} resizeMode="cover" />
            <PrimaryButton
              label={t("photoReport.button")}
              variant="ghost"
              onPress={reportPhoto}
              loading={busy}
              style={{ marginTop: 8 }}
            />
          </View>
        ) : null}

        {!done ? (
          <>
            <PrimaryButton
              label={t("taskDetail.childMarkDone")}
              onPress={() => void markDone(false)}
              loading={busy}
              large
              style={{ marginTop: 24 }}
            />
            <PrimaryButton
              label={t("taskDetail.childDonePhoto")}
              variant="secondary"
              onPress={() => void markDone(true)}
              loading={busy}
              large
              style={{ marginTop: 12 }}
            />
          </>
        ) : (
          <PrimaryButton
            label={t("taskDetail.childUnmark")}
            variant="ghost"
            onPress={() => void unmarkTaskDone(task.id)}
            style={{ marginTop: 24 }}
          />
        )}

        <PrimaryButton label={t("common.back")} variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: 8 }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.emoji}>{child?.emoji ?? "✅"}</Text>
      <Text style={styles.title}>{task.title}</Text>
      <Text style={styles.meta}>
        {child?.name ?? t("taskDetail.childFallback")} · {task.time} · {recurrenceLabel(task.recurrence, task.intervalWeeks)}
      </Text>
      <Text style={styles.meta}>
        {t("taskDetail.reminder", { value: task.reminderEnabled ? t("common.yes") : t("common.no"), date: todayISO() })}
      </Text>

      <View style={[styles.badge, done ? styles.badgeDone : styles.badgeTodo]}>
        <Text style={styles.badgeText}>{done ? t("taskDetail.done") : t("taskDetail.todo")}</Text>
      </View>

      {doneAtTime ? (
        <Text style={styles.meta}>{t("taskDetail.doneAt", { time: doneAtTime })}</Text>
      ) : null}

      {done?.photoUri ? (
        <View style={styles.photoBox}>
          <Text style={styles.label}>{t("taskDetail.photoProof")}</Text>
          <Image source={{ uri: done.photoUri }} style={styles.photo} resizeMode="cover" />
          <PrimaryButton
            label={t("photoReport.button")}
            variant="ghost"
            onPress={reportPhoto}
            loading={busy}
            style={{ marginTop: 8 }}
          />
        </View>
      ) : (
        <Text style={styles.help}>{t("taskDetail.noPhoto")}</Text>
      )}

      {Platform.OS === "web" && (
        <View style={styles.webNote}>
          <Text style={styles.webNoteText}>{t("taskDetail.webNote")}</Text>
        </View>
      )}

      {done && (
        <PrimaryButton
          label={t("taskDetail.unmark")}
          variant="ghost"
          onPress={() => void unmarkTaskDone(task.id)}
          style={{ marginTop: 8 }}
        />
      )}

      {currentProfile?.role === "parent" && (
        <PrimaryButton
          label={t("taskDetail.edit")}
          variant="secondary"
          onPress={() => navigation.navigate("TaskForm", { taskId: task.id })}
          style={{ marginTop: 8 }}
        />
      )}

      <PrimaryButton label={t("common.back")} variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: { padding: 16, paddingBottom: 40, backgroundColor: colors.bg, flexGrow: 1 },
  statusEmoji: { fontSize: 72, textAlign: "center", marginTop: 8 },
  emoji: { fontSize: 40 },
  childEmoji: { fontSize: 40, textAlign: "center" },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, marginTop: 8 },
  childTitle: { fontSize: 28, fontWeight: "800", color: colors.text, marginTop: 8, textAlign: "center" },
  childTime: { fontSize: 20, fontWeight: "700", color: colors.textMuted, marginTop: 8, textAlign: "center" },
  meta: { color: colors.textMuted, marginTop: 4 },
  badge: { alignSelf: "flex-start", marginTop: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeDone: { backgroundColor: colors.successSoft },
  badgeTodo: { backgroundColor: colors.primarySoft },
  badgeText: { fontWeight: "800", color: colors.text },
  photoBox: { marginTop: 16 },
  label: { fontWeight: "700", marginBottom: 8, color: colors.text },
  photo: { width: "100%", height: 220, borderRadius: 16, backgroundColor: colors.border },
  help: { marginTop: 16, color: colors.textMuted },
  webNote: {
    marginTop: 16,
    backgroundColor: "#FFF4E5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FFD8A8",
  },
  webNoteText: { color: "#9C5B00", fontSize: 13, lineHeight: 18 },
});
