import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useApp } from "../context/AppContext";
import { PrimaryButton } from "../components/PrimaryButton";
import { RootStackParamList } from "../navigation/types";
import { useParentOnlyGuard } from "../navigation/useParentOnlyGuard";
import { childColors, colors } from "../theme/colors";
import { confirmUser, notifyUser } from "../utils/feedback";
import { frenchCloudError } from "../utils/cloudTimeout";

type Props = NativeStackScreenProps<RootStackParamList, "ChildForm">;

const EMOJI_CHOICES = ["🦁", "🦄", "🦊", "🐻", "🐼", "🐸", "🐰", "🐯", "🐨", "🐶", "🐱", "🌟"];

export function ChildFormScreen({ navigation, route }: Props) {
  const blocked = useParentOnlyGuard(navigation);
  const { getProfile, childrenProfiles, addChild, updateChild, deleteChild } = useApp();
  const existing = route.params.childId ? getProfile(route.params.childId) : undefined;
  const isEdit = !!existing && existing.role === "child";

  const defaultColor =
    childColors[childrenProfiles.length % childColors.length] ?? childColors[0];

  const [name, setName] = useState(isEdit ? existing.name : "");
  const [emoji, setEmoji] = useState(isEdit ? existing.emoji : "🌟");
  const [color, setColor] = useState(isEdit ? existing.color : defaultColor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => name.trim().length > 0, [name]);

  if (blocked) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: 24 }}>
        <Text style={{ color: colors.textMuted, fontWeight: "600" }}>Espace parent réservé.</Text>
      </View>
    );
  }

  const onSave = async () => {
    if (!canSave) {
      notifyUser("Formulaire", "Le prénom de l'enfant est requis.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (isEdit && existing) {
        await updateChild(existing.id, {
          name: name.trim(),
          emoji: emoji.trim() || "🌟",
          color,
        });
        setSaving(false);
        notifyUser("Enfant mis à jour", `${name.trim()} a été enregistré.`);
      } else {
        await addChild({
          name: name.trim(),
          emoji: emoji.trim() || "🌟",
          color,
        });
        setSaving(false);
        notifyUser("Enfant ajouté", `${name.trim()} apparaît dans le sélecteur et les filtres.`);
      }
      navigation.goBack();
    } catch (e) {
      const msg = frenchCloudError(e, "Impossible d'enregistrer l'enfant.");
      setError(msg);
      setSaving(false);
      notifyUser("Erreur", msg);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!isEdit || !existing) return;
    void (async () => {
      const ok = await confirmUser(
        "Supprimer cet enfant ?",
        `« ${existing.name} » et ses tâches / complétions seront retirés. Cette action est irréversible.`,
        "Supprimer"
      );
      if (!ok) return;
      setSaving(true);
      setError(null);
      try {
        await deleteChild(existing.id);
        setSaving(false);
        notifyUser("Enfant supprimé", `${existing.name} a été retiré de la famille.`);
        navigation.goBack();
      } catch (e) {
        const msg = frenchCloudError(e, "Impossible de supprimer l'enfant.");
        setError(msg);
        setSaving(false);
        notifyUser("Erreur", msg);
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{isEdit ? "Modifier l'enfant" : "Ajouter un enfant"}</Text>
      <Text style={styles.hint}>
        Le profil apparaît dans le sélecteur, le tableau de bord, le calendrier et le formulaire de tâche.
      </Text>

      <Text style={styles.label}>Prénom *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Ex. Léo"
        placeholderTextColor={colors.textMuted}
        autoFocus={!isEdit}
      />

      <Text style={styles.label}>Emoji (optionnel)</Text>
      <View style={styles.rowWrap}>
        {EMOJI_CHOICES.map((e) => (
          <Pressable
            key={e}
            onPress={() => setEmoji(e)}
            style={[styles.emojiChip, emoji === e && styles.emojiChipActive]}
          >
            <Text style={styles.emojiText}>{e}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Couleur (optionnel)</Text>
      <View style={styles.rowWrap}>
        {childColors.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[
              styles.colorChip,
              { backgroundColor: c },
              color === c && styles.colorChipActive,
            ]}
          />
        ))}
      </View>

      <View style={[styles.preview, { borderColor: color }]}>
        <Text style={styles.previewEmoji}>{emoji}</Text>
        <Text style={styles.previewName}>{name.trim() || "Prénom"}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={isEdit ? "Enregistrer" : "Ajouter l'enfant"}
        onPress={() => void onSave()}
        loading={saving}
        disabled={!canSave || saving}
        style={{ marginTop: 8 }}
      />

      {isEdit ? (
        <PrimaryButton
          label="Supprimer l'enfant"
          variant="danger"
          onPress={onDelete}
          disabled={saving}
          style={{ marginTop: 12 }}
        />
      ) : null}

      <PrimaryButton
        label="Annuler"
        variant="ghost"
        onPress={() => navigation.goBack()}
        disabled={saving}
        style={{ marginTop: 10 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48, backgroundColor: colors.bg, flexGrow: 1 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  hint: { marginTop: 8, marginBottom: 16, color: colors.textMuted, lineHeight: 20 },
  label: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiChip: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  emojiText: { fontSize: 24 },
  colorChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorChipActive: { borderColor: colors.text, transform: [{ scale: 1.08 }] },
  preview: {
    marginTop: 20,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewEmoji: { fontSize: 32 },
  previewName: { fontSize: 17, fontWeight: "800", color: colors.text },
  error: {
    marginTop: 12,
    color: colors.danger,
    fontWeight: "600",
    backgroundColor: "#FEECEC",
    padding: 10,
    borderRadius: 10,
  },
});
