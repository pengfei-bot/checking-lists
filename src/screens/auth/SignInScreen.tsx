import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../auth";
import { PrimaryButton } from "../../components/PrimaryButton";
import { RootStackParamList } from "../../navigation/types";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;

export function SignInScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn({ email, password });
      navigation.replace("ProfilePicker");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Se connecter</Text>
        <Text style={styles.hint}>Compte parent local (prototype).</Text>

        <Text style={styles.label}>E-mail</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="parent@exemple.fr"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          autoComplete="password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label="Connexion"
          loading={busy}
          onPress={() => void onSubmit()}
          style={{ marginTop: 16 }}
        />
        <PrimaryButton
          label="Mot de passe oublié"
          variant="ghost"
          onPress={() => navigation.navigate("ForgotPassword")}
          style={{ marginTop: 10 }}
        />
        <PrimaryButton
          label="Créer un compte"
          variant="secondary"
          onPress={() => navigation.navigate("SignUp")}
          style={{ marginTop: 10 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40, backgroundColor: colors.bg, flexGrow: 1 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 8 },
  hint: { color: colors.textMuted, marginBottom: 20, lineHeight: 20 },
  label: { fontWeight: "700", color: colors.textMuted, marginBottom: 6, marginTop: 10, fontSize: 13 },
  input: {
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
