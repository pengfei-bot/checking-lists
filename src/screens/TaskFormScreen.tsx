import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
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
import { useParentOnlyGuard } from "../navigation/useParentOnlyGuard";
import { PrimaryButton } from "../components/PrimaryButton";
import { Recurrence } from "../types";
import { todayISO } from "../utils/dates";
import { recurrenceLabel } from "../utils/recurrence";

type Props = NativeStackScreenProps<RootStackParamList, "TaskForm">;

const RECURRENCES: Recurrence[] = ["daily", "weekdays", "once"];

type PeriodId = "matin" | "midi" | "apresmidi" | "soir";

const PERIODS: { id: PeriodId; label: string; hint: string; defaultTime: string }[] = [
  { id: "matin", label: "Matin", hint: "06:00–11:30", defaultTime: "08:00" },
  { id: "midi", label: "Midi", hint: "12:00–13:30", defaultTime: "12:00" },
  { id: "apresmidi", label: "Après-midi", hint: "14:00–17:30", defaultTime: "16:00" },
  { id: "soir", label: "Soir", hint: "18:00–22:00", defaultTime: "19:00" },
];

function buildHalfHourSlots(startHour: number, endHour: number, endMinute = 0): string[] {
  const slots: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (const m of [0, 30]) {
      if (h === endHour && m > endMinute) break;
      if (h === startHour && m < 0) continue;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

const TIMES_BY_PERIOD: Record<PeriodId, string[]> = {
  matin: buildHalfHourSlots(6, 11, 30),
  midi: buildHalfHourSlots(12, 13, 30),
  apresmidi: buildHalfHourSlots(14, 17, 30),
  soir: buildHalfHourSlots(18, 22, 0),
};

const ALL_TIMES = buildHalfHourSlots(6, 22, 0);

function periodForTime(t: string): PeriodId {
  const [hh] = t.split(":").map(Number);
  if (hh < 12) return "matin";
  if (hh < 14) return "midi";
  if (hh < 18) return "apresmidi";
  return "soir";
}

interface FieldErrors {
  title?: string;
  childId?: string;
  time?: string;
  onceDate?: string;
}

function validateForm(input: {
  title: string;
  childId: string;
  time: string;
  recurrence: Recurrence;
  onceDate: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.title.trim()) errors.title = "Le titre est requis.";
  if (!input.childId) errors.childId = "Choisissez un enfant.";
  if (!/^\d{2}:\d{2}$/.test(input.time)) {
    errors.time = "Choisissez une heure (ex. 17:00).";
  }
  if (input.recurrence === "once" && !/^\d{4}-\d{2}-\d{2}$/.test(input.onceDate)) {
    errors.onceDate = "Indiquez une date au format AAAA-MM-JJ.";
  }
  return errors;
}

export function TaskFormScreen({ navigation, route }: Props) {
  const blocked = useParentOnlyGuard(navigation);
  const { getTask, childrenProfiles, upsertTask, deleteTask } = useApp();
  const existing = route.params.taskId ? getTask(route.params.taskId) : undefined;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [childId, setChildId] = useState(
    existing?.childId ?? route.params.childId ?? childrenProfiles[0]?.id ?? ""
  );
  const [time, setTime] = useState(existing?.time ?? "17:00");
  const [period, setPeriod] = useState<PeriodId>(() =>
    periodForTime(existing?.time ?? "17:00")
  );
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [recurrence, setRecurrence] = useState<Recurrence>(existing?.recurrence ?? "daily");
  const [reminderEnabled, setReminderEnabled] = useState(existing?.reminderEnabled ?? true);
  const [onceDate, setOnceDate] = useState(existing?.onceDate ?? todayISO());
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const isEdit = !!existing;

  const fieldErrors = useMemo(
    () => validateForm({ title, childId, time, recurrence, onceDate }),
    [title, childId, time, recurrence, onceDate]
  );
  const errorList = Object.values(fieldErrors).filter(Boolean) as string[];
  const isValid = errorList.length === 0;

  const onSave = async () => {
    setAttempted(true);
    if (!isValid) return;
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
    Alert.alert("Supprimer ?", "Cette tâche sera supprimée.", [
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

  const selectPeriod = (id: PeriodId) => {
    setPeriod(id);
    const preset = PERIODS.find((p) => p.id === id)!;
    const slots = TIMES_BY_PERIOD[id];
    if (!slots.includes(time)) {
      setTime(preset.defaultTime);
    }
  };

  if (blocked) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedText}>Espace parent réservé.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{isEdit ? "Modifier la tâche" : "Nouvelle tâche"}</Text>

      <Text style={styles.label}>Titre</Text>
      <TextInput
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          if (attempted) setAttempted(true);
        }}
        placeholder="Ex: Faire ses devoirs"
        style={[styles.input, attempted && fieldErrors.title ? styles.inputError : null]}
        placeholderTextColor={colors.textMuted}
      />
      {attempted && fieldErrors.title ? (
        <Text style={styles.fieldError}>{fieldErrors.title}</Text>
      ) : null}

      <Text style={styles.label}>Enfant</Text>
      <View style={styles.rowWrap}>
        {childrenProfiles.length === 0 ? (
          <Text style={styles.help}>Aucun profil enfant — créez-en un d'abord.</Text>
        ) : (
          childrenProfiles.map((c) => (
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
          ))
        )}
      </View>
      {attempted && fieldErrors.childId ? (
        <Text style={styles.fieldError}>{fieldErrors.childId}</Text>
      ) : null}

      <Text style={styles.label}>Heure</Text>
      <View style={styles.rowWrap}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => selectPeriod(p.id)}
            style={[styles.chip, period === p.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, period === p.id && styles.chipTextActive]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => setTimePickerOpen(true)}
        style={[
          styles.timeButton,
          attempted && fieldErrors.time ? styles.inputError : null,
        ]}
      >
        <Text style={styles.timeButtonLabel}>{time || "Choisir…"}</Text>
        <Text style={styles.timeButtonHint}>Toucher pour choisir · créneaux 30 min</Text>
      </Pressable>
      {attempted && fieldErrors.time ? (
        <Text style={styles.fieldError}>{fieldErrors.time}</Text>
      ) : null}

      <View style={styles.rowWrap}>
        {TIMES_BY_PERIOD[period].map((t) => (
          <Pressable
            key={t}
            onPress={() => setTime(t)}
            style={[styles.timeChip, time === t && styles.chipActive]}
          >
            <Text style={[styles.chipText, time === t && styles.chipTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Récurrence</Text>
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
            style={[styles.input, attempted && fieldErrors.onceDate ? styles.inputError : null]}
            autoCapitalize="none"
            placeholderTextColor={colors.textMuted}
          />
          {attempted && fieldErrors.onceDate ? (
            <Text style={styles.fieldError}>{fieldErrors.onceDate}</Text>
          ) : null}
        </>
      )}

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.labelInline}>Rappel local</Text>
          <Text style={styles.help}>
            Sur le web: non disponible (bannière informative). Sur mobile: expo-notifications.
          </Text>
        </View>
        <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />
      </View>

      {attempted && !isValid ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxTitle}>À compléter :</Text>
          {errorList.map((msg) => (
            <Text key={msg} style={styles.errorBoxItem}>
              • {msg}
            </Text>
          ))}
        </View>
      ) : null}

      <PrimaryButton
        label={isEdit ? "Enregistrer" : "Créer"}
        onPress={() => void onSave()}
        loading={saving}
        style={{ marginTop: 16 }}
      />
      {isEdit && (
        <PrimaryButton
          label="Supprimer"
          variant="danger"
          onPress={onDelete}
          style={{ marginTop: 10 }}
        />
      )}
      <PrimaryButton
        label="Annuler"
        variant="ghost"
        onPress={() => navigation.goBack()}
        style={{ marginTop: 10 }}
      />

      <Modal
        visible={timePickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setTimePickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choisir l'heure</Text>
            <Text style={styles.help}>Créneaux toutes les 30 minutes (06:00–22:00)</Text>
            <ScrollView style={styles.modalList}>
              {ALL_TIMES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => {
                    setTime(t);
                    setPeriod(periodForTime(t));
                    setTimePickerOpen(false);
                  }}
                  style={[styles.modalRow, time === t && styles.modalRowActive]}
                >
                  <Text
                    style={[styles.modalRowText, time === t && styles.modalRowTextActive]}
                  >
                    {t}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <PrimaryButton
              label="Fermer"
              variant="ghost"
              onPress={() => setTimePickerOpen(false)}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  blocked: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    padding: 24,
  },
  blockedText: { color: colors.textMuted, fontWeight: "600" },
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
  inputError: { borderColor: colors.danger },
  fieldError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  timeButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  timeButtonLabel: { fontSize: 22, fontWeight: "800", color: colors.text },
  timeButtonHint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  timeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
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
  errorBox: {
    marginTop: 16,
    backgroundColor: "#FEECEC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F5C2C0",
  },
  errorBoxTitle: { fontWeight: "800", color: colors.danger, marginBottom: 4 },
  errorBoxItem: { color: colors.danger, fontWeight: "600", marginTop: 2 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "70%",
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 4 },
  modalList: { marginTop: 8 },
  modalRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalRowActive: { backgroundColor: colors.primarySoft },
  modalRowText: { fontSize: 17, fontWeight: "600", color: colors.text, textAlign: "center" },
  modalRowTextActive: { color: colors.primary, fontWeight: "800" },
});
