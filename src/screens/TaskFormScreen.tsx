import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";
import { PrimaryButton } from "../components/PrimaryButton";
import { Recurrence } from "../types";
import { todayISO } from "../utils/dates";
import { recurrenceLabel } from "../utils/recurrence";

type Props = NativeStackScreenProps<RootStackParamList, "TaskForm">;

const RECURRENCES: Recurrence[] = ["daily", "weekdays", "once"];

export function TaskFormScreen({ navigation, route }: Props) {
  const { getTask, childrenProfiles, upsertTask, deleteTask } = useApp();
  const existing = route.params.taskId ? getTask(route.params.taskId) : undefined;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [childId, setChildId] = useState(
    existing?.childId ?? route.params.childId ?? childrenProfiles[0]?.id ?? ""
  );
  const [time, setTime] = useState(existing?.time ?? "17:00");
  const [recurrence, setRecurrence] = useState<Recurrence>(existing?.recurrence ?? "daily");
  const [reminderEnabled, setReminderEnabled] = useState(existing?.reminderEnabled ?? true);
  const [onceDate, setOnceDate] = useState(existing?.onceDate ?? todayISO());
  const [saving, setSaving] = useState(false);

  const isEdit = !!existing;

  const canSave = useMemo(
    () => title.trim().length > 0 && !!childId && /^\d{2}:\d{2}$/.test(time),
    [title, childId, time]
  );

  const onSave = async () => {
    if (!canSave) {
      Alert.alert("Formulaire", "Titre, enfant et heure (HH:mm) sont requis.");
      return;
    }
    setSaving(true);
    try {
      await upsertTask({
        id: existing?.id,
        title: title.trim(),
        childId,
        time,
        recurrence,
        reminderEnabled,
        onceDate: recurrence === "once" ? onceDate : undefined,
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert("Supprimer ?", "Cette tache sera supprimee.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await deleteTask(existing.id);
          navigation.popToTop();
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{isEdit ? "Modifier la tache" : "Nouvelle tache"}</Text>

      <Text style={styles.label}>Titre</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Ex: Faire ses devoirs"
        style={styles.input}
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Enfant</Text>
      <View style={styles.rowWrap}>
        {childrenProfiles.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setChildId(c.id)}
            style={[
              styles.chip,
              childId === c.id && { backgroundColor: c.color, borderColor: c.color },
            ]}
          >
            <Text style={[styles.chipText, childId === c.id && { color: "#fff" }]}>
              {c.emoji} {c.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Heure (HH:mm)</Text>
      <TextInput
        value={time}
        onChangeText={setTime}
        placeholder="17:00"
        style={styles.input}
        autoCapitalize="none"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Recurrence</Text>
      <View style={styles.rowWrap}>
        {RECURRENCES.map((r) => (
          <Pressable
            key={r}
            onPress={() => setRecurrence(r)}
            style={[styles.chip, recurrence === r && styles.chipActive]}
          >
            <Text style={[styles.chipText, recurrence === r && styles.chipTextActive]}>
              {recurrenceLabel(r)}
            </Text>
          </Pressable>
        ))}
      </View>

      {recurrence === "once" && (
        <>
          <Text style={styles.label}>Date (AAAA-MM-JJ)</Text>
          <TextInput
            value={onceDate}
            onChangeText={setOnceDate}
            placeholder={todayISO()}
            style={styles.input}
            autoCapitalize="none"
            placeholderTextColor={colors.textMuted}
          />
        </>
      )}

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.labelInline}>Rappel local</Text>
          <Text style={styles.help}>
            Sur le web: non disponible (banniere informative). Sur mobile: expo-notifications.
          </Text>
        </View>
        <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />
      </View>

      <PrimaryButton
        label={isEdit ? "Enregistrer" : "Creer"}
        onPress={() => void onSave()}
        loading={saving}
        disabled={!canSave}
        style={{ marginTop: 16 }}
      />
      {isEdit && (
        <PrimaryButton label="Supprimer" variant="danger" onPress={onDelete} style={{ marginTop: 10 }} />
      )}
      <PrimaryButton label="Annuler" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, backgroundColor: colors.bg, flexGrow: 1 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 12 },
  label: { fontWeight: "700", color: colors.textMuted, marginTop: 12, marginBottom: 6 },
  labelInline: { fontWeight: "700", color: colors.text },
  help: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontWeight: "700", color: colors.text },
  chipTextActive: { color: "#fff" },
  switchRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
