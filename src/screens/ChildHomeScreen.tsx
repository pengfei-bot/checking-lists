import React, { useMemo } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";
import { TaskCard } from "../components/TaskCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { formatFrenchDate, todayISO } from "../utils/dates";
import { ensureNotificationPermissions, notificationsSupported } from "../services/notifications";
import { addTodayTasksToCalendar, calendarSupported } from "../services/calendar";

type Props = NativeStackScreenProps<RootStackParamList, "ChildHome">;

const MOCK_PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function ChildHomeScreen({ navigation }: Props) {
  const {
    currentProfile,
    tasksForChildToday,
    completionFor,
    markTaskDone,
    unmarkTaskDone,
    setCurrentProfileId,
    state,
    refreshReminders,
  } = useApp();

  if (!currentProfile || currentProfile.role !== "child") {
    return (
      <View style={styles.center}>
        <Text>Profil enfant requis.</Text>
        <PrimaryButton
          label="Changer de profil"
          onPress={() => {
            setCurrentProfileId(null);
            navigation.replace("ProfilePicker");
          }}
          style={{ marginTop: 12 }}
        />
      </View>
    );
  }

  const tasks = tasksForChildToday(currentProfile.id);
  const doneCount = tasks.filter((t) => completionFor(t.id)).length;
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const header = useMemo(
    () => (
      <View style={[styles.hero, { backgroundColor: currentProfile.color + "22" }]}>
        <Text style={styles.heroEmoji}>{currentProfile.emoji}</Text>
        <Text style={styles.heroTitle}>Salut {currentProfile.name} !</Text>
        <Text style={styles.heroSub}>{formatFrenchDate(todayISO())}</Text>
        <Text style={styles.progress}>
          {doneCount}/{tasks.length} terminees · {progress}%
        </Text>
      </View>
    ),
    [currentProfile, doneCount, tasks.length, progress]
  );

  const quickDone = async (taskId: string) => {
    const existing = completionFor(taskId);
    if (existing) {
      await unmarkTaskDone(taskId);
      return;
    }
    await markTaskDone(taskId, currentProfile.id);
  };

  const doneWithPhoto = async (taskId: string) => {
    if (Platform.OS === "web") {
      try {
        const pick = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.6,
        });
        if (!pick.canceled && pick.assets[0]?.uri) {
          await markTaskDone(taskId, currentProfile.id, pick.assets[0].uri);
          return;
        }
      } catch {
        // ignore
      }
      await markTaskDone(taskId, currentProfile.id, MOCK_PHOTO);
      Alert.alert("Demo web", "Photo mock utilisee (ou choisissez un fichier image).");
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!lib.granted) {
        Alert.alert("Permission refusee", "Autorisez la camera ou la galerie.");
        return;
      }
      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.6,
      });
      if (!pick.canceled && pick.assets[0]) {
        await markTaskDone(taskId, currentProfile.id, pick.assets[0].uri);
      }
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!shot.canceled && shot.assets[0]) {
      await markTaskDone(taskId, currentProfile.id, shot.assets[0].uri);
    }
  };

  const onReminders = async () => {
    if (!notificationsSupported()) {
      Alert.alert(
        "Notifications",
        "Les rappels locaux ne fonctionnent pas sur le web. Testez avec Expo Go sur un appareil reel."
      );
      return;
    }
    const ok = await ensureNotificationPermissions();
    if (!ok) {
      Alert.alert("Permission refusee", "Activez les notifications dans les reglages.");
      return;
    }
    const n = await refreshReminders();
    Alert.alert("Rappels", `${n} rappel(s) planifie(s) pour aujourd'hui.`);
  };

  const onCalendar = async () => {
    const result = await addTodayTasksToCalendar(state.tasks, state.profiles, currentProfile.id);
    Alert.alert("Calendrier", result.message);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        {header}
        {tasks.length === 0 ? (
          <Text style={styles.empty}>Pas de taches pour aujourd'hui</Text>
        ) : (
          tasks.map((task) => {
            const done = !!completionFor(task.id);
            return (
              <TaskCard
                key={task.id}
                task={task}
                done={done}
                onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                rightAccessory={
                  <View style={styles.actions}>
                    <Pressable style={styles.miniBtn} onPress={() => void quickDone(task.id)}>
                      <Text style={styles.miniText}>{done ? "UNDO" : "OK"}</Text>
                    </Pressable>
                    {!done && (
                      <Pressable style={styles.miniBtn} onPress={() => void doneWithPhoto(task.id)}>
                        <Text style={styles.miniText}>PHOTO</Text>
                      </Pressable>
                    )}
                  </View>
                }
              />
            );
          })
        )}

        <PrimaryButton label="Activer / rafraichir les rappels" variant="secondary" onPress={() => void onReminders()} style={{ marginTop: 8 }} />
        {calendarSupported() && (
          <PrimaryButton label="Ajouter mes taches au calendrier" variant="ghost" onPress={() => void onCalendar()} style={{ marginTop: 8 }} />
        )}
        <PrimaryButton
          label="Changer de profil"
          variant="ghost"
          onPress={() => {
            setCurrentProfileId(null);
            navigation.replace("ProfilePicker");
          }}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.kidBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: { padding: 16, paddingBottom: 40 },
  hero: { borderRadius: 20, padding: 18, marginBottom: 16 },
  heroEmoji: { fontSize: 40 },
  heroTitle: { fontSize: 24, fontWeight: "800", color: colors.text, marginTop: 4 },
  heroSub: { color: colors.textMuted, textTransform: "capitalize", marginTop: 2 },
  progress: { marginTop: 10, fontWeight: "700", color: colors.primary },
  empty: { textAlign: "center", color: colors.textMuted, marginVertical: 24, fontSize: 16 },
  actions: { flexDirection: "row", gap: 6 },
  miniBtn: {
    minWidth: 44,
    height: 40,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  miniText: { fontSize: 11, fontWeight: "800", color: colors.primary },
});
