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
import { useTranslation } from "react-i18next";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "RedeemInvite">;

export function RedeemInviteScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { redeemInvite } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      await redeemInvite(code);
      navigation.reset({ index: 0, routes: [{ name: "ProfilePicker" }] });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("redeem.invalid"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>{t("redeem.title")}</Text>
      <Text style={styles.hint}>{t("redeem.hint")}</Text>

      <Text style={styles.label}>{t("redeem.codeLabel")}</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        placeholder={t("redeem.codePlaceholder")}
        autoCapitalize="characters"
        maxLength={6}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={t("redeem.submit")}
        loading={busy}
        onPress={() => void onSubmit()}
        style={{ marginTop: 16 }}
      />
      <PrimaryButton
        label={t("common.back")}
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
  error: {
    marginTop: 12,
    color: colors.danger,
    fontWeight: "600",
    backgroundColor: "#FEECEC",
    padding: 10,
    borderRadius: 10,
  },
});
