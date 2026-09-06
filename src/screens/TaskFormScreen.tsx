import React, { useMemo, useState } from "react";
import {
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
import { Recurrence, Task } from "../types";
import { frenchCloudError } from "../utils/cloudTimeout";
import { todayISO } from "../utils/dates";
import { confirmUser, notifyUser } from "../utils/feedback";
import { recurrenceLabel } from "../utils/recurrence";

type Props = NativeStackScreenProps<RootStackParamList, "TaskForm">;

const RECURRENCES: Recurrence[] = ["daily", "weekdays", "once"];

type PeriodId = "matin" | "midi" | "apresmidi" | "soir";

const PERIODS: { id: PeriodId; label: string; hint: string; defaultTime: string }[] = [
  { id: "matin", label: "Matin", hint: "06:00–11:45", defaultTime: "08:00" },
  { id: "midi", label: "Midi", hint: "12:00–13:45", defaultTime: "12:00" },
  { id: "apresmidi", label: "Après-midi", hint: "14:00–17:45", defaultTime: "16:00" },
  { id: "soir", label: "Soir", hint: "18:00–22:00", defaultTime: "19:00" },
];

/** Quarter-hour slots so e.g. 10:15 is selectable. */
function buildQuarterHourSlots(startHour: number, endHour: number, endMinute = 0): string[] {
  const slots: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === endHour && m > endMinute) break;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

const TIMES_BY_PERIOD: Record<PeriodId, string[]> = {
  matin: buildQuarterHourSlots(6, 11, 45),
  midi: buildQuarterHourSlots(12, 13, 45),
  apresmidi: buildQuarterHourSlots(14, 17, 45),
  soir: buildQuarterHourSlots(18, 22, 0),
};

const ALL_TIMES = buildQuarterHourSlots(6, 22, 0);

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
  /** Selected child ids (create and edit: at least one). */
  childIds: string[];
  time: string;
  recurrence: Recurrence;
  onceDate: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.title.trim()) errors.title = "Le titre est requis.";
  if (input.childIds.length === 0) errors.childId = "Choisis au moins un enfant.";
  if (!/^\d{2}:\d{2}$/.test(input.time)) {
    errors.time = "Choisissez une heure (ex. 10:15).";
  }
  if (input.recurrence === "once" && !/^\d{4}-\d{2}-\d{2}$/.test(input.onceDate)) {
    errors.onceDate = "Indiquez une date au format AAAA-MM-JJ.";
  }
  return errors;
}

export function TaskFormScreen({ navigation, route }: Props) {
  const blocked = useParentOnlyGuard(navigation);
  const { getTask, childrenProfiles, upsertTask, deleteTask, state } = useApp();
  const existing = route.params.taskId ? getTask(route.params.taskId) : undefined;

  const [title, setTitle] = useState(existing?.title ?? "");
  /** Multi-select assignees (create and edit; at least one). */
  const [childIds, setChildIds] = useState<string[]>(() => {
    if (existing?.childId) return [existing.childId];
    const fromRoute = route.params.childId;
    if (fromRoute) return [fromRoute];
    const first = childrenProfiles[0]?.id;
    return first ? [first] : [];
  });
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
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = !!existing;

  const fieldErrors = useMemo(
    () => validateForm({ title, childIds, time, recurrence, onceDate }),
    [title, childIds, time, recurrence, onceDate]
  );
  const errorList = Object.values(fieldErrors).filter(Boolean) as string[];
  const isValid = errorList.length === 0;

  const toggleChild = (id: string) => {
    setChildIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const findSiblingForChild = (
    tasks: Task[],
    childId: string,
    attrs: { title: string; time: string; recurrence: Recurrence },
    excludeId?: string
  ): Task | undefined =>
    tasks.find(
      (t) =>
        t.id !== excludeId &&
        t.childId === childId &&
        t.title === attrs.title &&
        t.time === attrs.time &&
        t.recurrence === attrs.recurrence
    );

  const onSave = async () => {
    setAttempted(true);
    setFormError(null);
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        time,
        recurrence,
        reminderEnabled,
        onceDate: recurrence === "once" ? onceDate : undefined,
      };
      const selectedIds = childIds;

      if (isEdit && existing) {
        // Prefer keeping current child if still selected; else first selected.
        const finalChildId = selectedIds.includes(existing.childId)
          ? existing.childId
          : selectedIds[0];

        await upsertTask({
          id: existing.id,
          ...payload,
          childId: finalChildId,
        });

        // Upsert same attributes for every other selected child.
        const oldAttrs = {
          title: existing.title,
          time: existing.time,
          recurrence: existing.recurrence,
        };
        for (const cid of selectedIds) {
          if (cid === finalChildId) continue;
          const sibling =
            findSiblingForChild(state.tasks, cid, payload, existing.id) ??
            findSiblingForChild(state.tasks, cid, oldAttrs, existing.id);
          if (sibling) {
            await upsertTask({
              id: sibling.id,
              ...payload,
              childId: cid,
            });
          } else {
            await upsertTask({ ...payload, childId: cid });
          }
        }
      } else {
        // One tasks row per selected child (same title/time/recurrence/reminder)
        for (const cid of selectedIds) {
          await upsertTask({ ...payload, childId: cid });
        }
      }
      navigation.goBack();
    } catch (e) {
      const msg = frenchCloudError(e, "Impossible d'enregistrer la tâche.");
      setFormError(msg);
      setSaving(false);
      notifyUser("Erreur", msg);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!existing) return;
    void (async () => {
      const ok = await confirmUser(
        "Supprimer la tâche",
        "Supprimer définitivement ?",
        "Supprimer"
      );
      if (!ok) return;
      setSaving(true);
      setFormError(null);
      try {
        await deleteTask(existing.id);
        setSaving(false);
        navigation.goBack();
      } catch (e) {
        const msg = frenchCloudError(e, "Impossible de supprimer la tâche.");
        setFormError(msg);
        setSaving(false);
        notifyUser("Erreur", msg);
      } finally {
        setSaving(false);
      }
    })();
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

      <Text style={styles.label}>Enfants</Text>
      <Text style={styles.help}>
        Sélectionnez un ou plusieurs enfants (une tâche par enfant).
      </Text>
      <View style={styles.rowWrap}>
        {childrenProfiles.length === 0 ? (
          <Text style={styles.help}>Aucun profil enfant — créez-en un d'abord.</Text>
        ) : (
          childrenProfiles.map((c) => {
            const selected = childIds.includes(c.id);
            return (
              <Pressable
                key={c.id}
                onPress={() => toggleChild(c.id)}
                style={[
                  styles.chip,
                  selected && { backgroundColor: c.color, borderColor: c.color },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <Text style={[styles.chipText, selected && { color: "#fff" }]}>
                  {selected ? "✓ " : "○ "}
                  {c.emoji} {c.name}
                </Text>
              </Pressable>
            );
          })
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
        <Text style={styles.timeButtonHint}>Toucher pour choisir · créneaux 15 min</Text>
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

      {formError ? <Text style={styles.fieldError}>{formError}</Text> : null}

      <PrimaryButton
        label={isEdit ? "Enregistrer" : "Créer"}
        onPress={() => void onSave()}
        loading={saving}
        disabled={saving}
        style={{ marginTop: 16 }}
      />
      {isEdit && (
        <PrimaryButton
          label="Supprimer la tâche"
          variant="danger"
          onPress={onDelete}
          loading={saving}
          disabled={saving}
          style={{ marginTop: 10 }}
        />
      )}
      <PrimaryButton
        label="Annuler"
        variant="ghost"
        onPress={() => navigation.goBack()}
        disabled={saving}
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
            <Text style={styles.help}>Créneaux toutes les 15 minutes (06:00–22:00)</Text>
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
