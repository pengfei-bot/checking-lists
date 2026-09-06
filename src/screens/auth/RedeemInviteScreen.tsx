import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../auth";
import { PrimaryButton } from "../../components/PrimaryButton";
import { RootStackParamList } from "../../navigation/types";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "RedeemInvite">;

export function RedeemInviteScreen({ navigation }: Props) {
  const { redeemInvite } = useAuth();
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      await redeemInvite(code, nickname.trim() || undefined);
      navigation.replace("ProfilePicker");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Code invalide.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Rejoindre une famille</Text>
      <Text style={styles.hint}>
        Le parent affiche le code sur son téléphone. Entrez-le ici sur l'iPhone de l'enfant
        (réseau Internet requis). Vous verrez ensuite les profils et tâches de la famille.
      </Text>

      <Text style={styles.label}>Code d'invitation</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        placeholder="ABC123"
        autoCapitalize="characters"
        maxLength={8}
      />

      <Text style={styles.label}>Prénom (optionnel)</Text>
      <TextInput
        style={styles.inputName}
        value={nickname}
        onChangeText={setNickname}
        placeholder="Léo"
        autoCapitalize="words"
        maxLength={40}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label="Lier cet appareil"
        loading={busy}
        onPress={() => void onSubmit()}
        style={{ marginTop: 16 }}
      />
      <PrimaryButton
        label="Retour"
        variant="ghost"
        onPress={() => navigation.goBack()}
        style={{ marginTop: 10 }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 8 },
  hint: { color: colors.textMuted, marginBottom: 20, lineHeight: 20 },
  label: { fontWeight: "700", color: colors.textMuted, marginBottom: 6, fontSize: 13 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 4,
    fontWeight: "800",
    textAlign: "center",
    color: colors.text,
    marginBottom: 12,
  },
  inputName: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  error: {
    marginTop: 12,
    color: colors.danger,
    fontWeight: "600",
    backgroundColor: "#FEECEC",
    padding: 10,
    borderRadius: 10,
  },
});
