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
import { useTranslation } from "react-i18next";
import { useApp } from "../context/AppContext";
import { PrimaryButton } from "../components/PrimaryButton";
import { ColorChips } from "../components/ColorChips";
import { RootStackParamList } from "../navigation/types";
import { useParentOnlyGuard } from "../navigation/useParentOnlyGuard";
import { childColors, colors } from "../theme/colors";
import { rewardsUi } from "../theme/rewardsUi";
import { confirmUser, notifyUser } from "../utils/feedback";
import { frenchCloudError } from "../utils/cloudTimeout";

type Props = NativeStackScreenProps<RootStackParamList, "ChildForm">;

const EMOJI_CHOICES = ["🦁", "🐯", "🐼", "🐶", "🐰", "🦕", "🦄", "🦊", "🐻", "🐸", "🐨", "🌟"];

export function ChildFormScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const blocked = useParentOnlyGuard(navigation);
  const { getProfile, childrenProfiles, addChild, updateChild, deleteChild } = useApp();
  const existing = route.params.childId ? getProfile(route.params.childId) : undefined;
  const isEdit = !!existing && existing.role === "child";

  const defaultColor =
    childColors[childrenProfiles.length % childColors.length] ?? childColors[0];

  const [name, setName] = useState(isEdit ? existing.name : "");
  const [emoji, setEmoji] = useState(isEdit ? existing.emoji : "🦁");
  const [color, setColor] = useState(isEdit ? existing.color : defaultColor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => name.trim().length > 0, [name]);

  if (blocked) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: 24 }}>
        <Text style={{ color: colors.textMuted, fontWeight: "600" }}>{t("roles.parentOnlyShort")}</Text>
      </View>
    );
  }

  const onSave = async () => {
    if (!canSave) {
      notifyUser(t("childForm.formTitle"), t("childForm.nameRequired"));
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
        notifyUser(t("childForm.updatedTitle"), t("childForm.updatedBody", { name: name.trim() }));
      } else {
        await addChild({
          name: name.trim(),
          emoji: emoji.trim() || "🌟",
          color,
        });
        setSaving(false);
        notifyUser(t("childForm.addedTitle"), t("childForm.addedBody", { name: name.trim() }));
      }
      navigation.goBack();
    } catch (e) {
      const msg = frenchCloudError(e, t("childForm.saveFailed"));
      setError(msg);
      setSaving(false);
      notifyUser(t("common.error"), msg);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!isEdit || !existing) return;
    void (async () => {
      const ok = await confirmUser(
        t("childForm.deleteTitle"),
        t("childForm.deleteBody", { name: existing.name }),
        t("common.delete")
      );
      if (!ok) return;
      setSaving(true);
      setError(null);
      try {
        await deleteChild(existing.id);
        setSaving(false);
        notifyUser(t("childForm.deletedTitle"), t("childForm.deletedBody", { name: existing.name }));
        navigation.goBack();
      } catch (e) {
        const msg = frenchCloudError(e, t("childForm.deleteFailed"));
        setError(msg);
        setSaving(false);
        notifyUser(t("common.error"), msg);
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{isEdit ? t("childForm.editTitle") : t("childForm.newTitle")}</Text>

      {/* Prénom */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t("childForm.name")}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t("childForm.namePlaceholder")}
          placeholderTextColor={colors.textMuted}
          autoFocus={!isEdit}
        />
      </View>

      {/* Couleur */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t("childForm.color")}</Text>
        <ColorChips value={color} onChange={setColor} />
      </View>

      {/* Emoji */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t("childForm.emoji")}</Text>
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
      </View>

      <View style={styles.infoNote}>
        <Text style={styles.infoIcon}>ⓘ</Text>
        <Text style={styles.infoText}>{t("childForm.colorLaterNote")}</Text>
      </View>

      <View style={[styles.preview, { borderColor: color }]}>
        <Text style={styles.previewEmoji}>{emoji}</Text>
        <Text style={styles.previewName}>{name.trim() || t("childForm.namePlaceholder")}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={isEdit ? t("childForm.save") : t("childForm.create")}
        onPress={() => void onSave()}
        loading={saving}
        disabled={!canSave || saving}
        style={{ marginTop: 8 }}
      />

      {isEdit ? (
        <PrimaryButton
          label={t("childForm.delete")}
          variant="danger"
          onPress={onDelete}
          disabled={saving}
          style={{ marginTop: 12 }}
        />
      ) : null}

      <PrimaryButton
        label={t("common.cancel")}
        variant="ghost"
        onPress={() => navigation.goBack()}
        disabled={saving}
        style={{ marginTop: 10 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 48,
    backgroundColor: rewardsUi.cream,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: rewardsUi.navy,
    marginBottom: 16,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...rewardsUi.shadow,
  },
  cardLabel: {
    marginBottom: 12,
    fontSize: 15,
    fontWeight: "800",
    color: rewardsUi.navy,
  },
  input: {
    backgroundColor: "#F7F8FC",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: rewardsUi.navy,
    fontWeight: "600",
  },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  emojiChipActive: { backgroundColor: rewardsUi.peachSoft },
  emojiText: { fontSize: 26 },
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  infoIcon: { fontSize: 14, color: colors.textMuted, marginTop: 1 },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    fontWeight: "600",
  },
  preview: {
    marginTop: 8,
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
  previewName: { fontSize: 17, fontWeight: "800", color: rewardsUi.navy },
  error: {
    marginTop: 12,
    color: colors.danger,
    fontWeight: "600",
    backgroundColor: "#FEECEC",
    padding: 10,
    borderRadius: 10,
  },
});
