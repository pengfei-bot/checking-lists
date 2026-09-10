import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PrimaryButton } from "../../components/PrimaryButton";
import { RootStackParamList } from "../../navigation/types";
import { useTranslation } from "react-i18next";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

/** Placeholder — real reset needs cloud auth (Supabase / Firebase). */
export function ForgotPasswordScreen({ navigation }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🔑</Text>
      <Text style={styles.title}>{t("forgot.title")}</Text>
      <Text style={styles.body}>{t("forgot.body")}</Text>
      <Text style={styles.note}>{t("forgot.note")}</Text>
      <PrimaryButton
        label={t("forgot.backToSignIn")}
        onPress={() => navigation.navigate("SignIn")}
        style={{ marginTop: 20 }}
      />
      <PrimaryButton
        label={t("forgot.home")}
        variant="ghost"
        onPress={() => navigation.navigate("Welcome")}
        style={{ marginTop: 10 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center" },
  emoji: { fontSize: 40, textAlign: "center" },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    color: colors.text,
    marginTop: 8,
    marginBottom: 12,
  },
  body: { color: colors.text, lineHeight: 22, textAlign: "center" },
  note: {
    marginTop: 16,
    color: colors.textMuted,
    lineHeight: 20,
    textAlign: "center",
    backgroundColor: colors.primarySoft,
    padding: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
});
