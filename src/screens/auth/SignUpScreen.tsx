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
import { useTranslation } from "react-i18next";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "SignUp">;

export function SignUpScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signUp({ email, password, displayName, familyName });
      navigation.replace("ProfilePicker");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("signUp.failed"));
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
        <Text style={styles.title}>{t("signUp.title")}</Text>
        <Text style={styles.hint}>{t("signUp.hint")}</Text>

        <Text style={styles.label}>{t("signUp.displayName")}</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t("signUp.displayNamePlaceholder")}
          autoCapitalize="words"
        />

        <Text style={styles.label}>{t("signUp.email")}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t("signUp.emailPlaceholder")}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Text style={styles.label}>{t("signUp.password")}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={t("signUp.passwordPlaceholder")}
          secureTextEntry
          autoComplete="password-new"
        />

        <Text style={styles.label}>{t("signUp.familyName")}</Text>
        <TextInput
          style={styles.input}
          value={familyName}
          onChangeText={setFamilyName}
          placeholder={t("signUp.familyNamePlaceholder")}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label={t("signUp.submit")}
          loading={busy}
          onPress={() => void onSubmit()}
          style={{ marginTop: 16 }}
        />
        <PrimaryButton
          label={t("signUp.haveAccount")}
          variant="ghost"
          onPress={() => navigation.navigate("SignIn")}
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
