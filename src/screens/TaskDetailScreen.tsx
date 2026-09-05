import React, { useState } from "react";
import {
  Alert,
  Image,
  Platform,
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
import { PrimaryButton } from "../components/PrimaryButton";
import { recurrenceLabel } from "../utils/recurrence";
import { todayISO } from "../utils/dates";

type Props = NativeStackScreenProps<RootStackParamList, "TaskDetail">;

const MOCK_PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function TaskDetailScreen({ navigation, route }: Props) {
  const {
    getTask,
    getProfile,
    completionFor,
    markTaskDone,
    unmarkTaskDone,
    currentProfile,
  } = useApp();
  const task = getTask(route.params.taskId);
  const [busy, setBusy] = useState(false);

  if (!task) {
    return (
      <View style={styles.center}>
        <Text>Tache introuvable.</Text>
        <PrimaryButton label="Retour" onPress={() => navigation.goBack()} style={{ marginTop: 12 }} />
      </View>
    );
  }

  const child = getProfile(task.childId);
  const done = completionFor(task.id);
  const isChild = currentProfile?.role === "child";

  const pickPhotoWebOrDevice = async (): Promise<string | undefined> => {
    if (Platform.OS === "web") {
      try {
        const pick = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.7,
        });
        if (!pick.canceled && pick.assets[0]?.uri) return pick.assets[0].uri;
      } catch {
        // fall through to mock
      }
      return MOCK_PHOTO;
    }

    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (cam.granted) {
      const shot = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (!shot.canceled && shot.assets[0]?.uri) return shot.assets[0].uri;
    }
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (lib.granted) {
      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
      if (!pick.canceled && pick.assets[0]?.uri) return pick.assets[0].uri;
    }
    return undefined;
  };

  const markDone = async (withPhoto: boolean) => {
    setBusy(true);
    try {
      let photoUri: string | undefined;
      if (withPhoto) {
        photoUri = await pickPhotoWebOrDevice();
        if (!photoUri && Platform.OS !== "web") {
          Alert.alert("Photo", "Aucune photo selectionnee.");
          return;
        }
        if (Platform.OS === "web" && photoUri === MOCK_PHOTO) {
          Alert.alert(
            "Demo web",
            "Fichier non choisi: une photo de demonstration a ete utilisee."
          );
        }
      }
      await markTaskDone(task.id, task.childId, photoUri);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.emoji}>{child?.emoji ?? "✅"}</Text>
      <Text style={styles.title}>{task.title}</Text>
      <Text style={styles.meta}>
        {child?.name ?? "Enfant"} · {task.time} · {recurrenceLabel(task.recurrence)}
      </Text>
      <Text style={styles.meta}>
        Rappel: {task.reminderEnabled ? "oui" : "non"} · {todayISO()}
      </Text>

      <View style={[styles.badge, done ? styles.badgeDone : styles.badgeTodo]}>
        <Text style={styles.badgeText}>{done ? "Terminee" : "A faire"}</Text>
      </View>

      {done?.photoUri ? (
        <View style={styles.photoBox}>
          <Text style={styles.label}>Photo preuve</Text>
          <Image source={{ uri: done.photoUri }} style={styles.photo} resizeMode="cover" />
        </View>
      ) : (
        <Text style={styles.help}>Pas encore de photo preuve.</Text>
      )}

      {Platform.OS === "web" && (
        <View style={styles.webNote}>
          <Text style={styles.webNoteText}>
            Demo navigateur: choisissez une image (file picker) ou une photo mock sera utilisee.
            Notifications locales desactivees sur le web.
          </Text>
        </View>
      )}

      {isChild && !done && (
        <>
          <PrimaryButton label="Marquer fait" onPress={() => void markDone(false)} loading={busy} style={{ marginTop: 8 }} />
          <PrimaryButton
            label={Platform.OS === "web" ? "Fait + photo (fichier / mock)" : "Fait + photo"}
            variant="secondary"
            onPress={() => void markDone(true)}
            loading={busy}
            style={{ marginTop: 8 }}
          />
        </>
      )}

      {done && (
        <PrimaryButton
          label="Annuler la validation"
          variant="ghost"
          onPress={() => void unmarkTaskDone(task.id)}
          style={{ marginTop: 8 }}
        />
      )}

      {currentProfile?.role === "parent" && (
        <PrimaryButton
          label="Modifier"
          variant="secondary"
          onPress={() => navigation.navigate("TaskForm", { taskId: task.id })}
          style={{ marginTop: 8 }}
        />
      )}

      <PrimaryButton label="Retour" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: { padding: 16, paddingBottom: 40, backgroundColor: colors.bg, flexGrow: 1 },
  emoji: { fontSize: 40 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, marginTop: 8 },
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
