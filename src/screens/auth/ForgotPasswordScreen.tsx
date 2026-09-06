import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PrimaryButton } from "../../components/PrimaryButton";
import { RootStackParamList } from "../../navigation/types";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

/** Placeholder — real reset needs cloud auth (Supabase / Firebase). */
export function ForgotPasswordScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🔑</Text>
      <Text style={styles.title}>Mot de passe oublié</Text>
      <Text style={styles.body}>
        La réinitialisation par e-mail n'est pas disponible en mode prototype local. Sur cet
        appareil, recréez un compte parent ou utilisez « Continuer en démo ».
      </Text>
      <Text style={styles.note}>
        Plus tard : reset via Supabase Auth / Firebase + e-mail (et Sign in with Apple sur iOS).
      </Text>
      <PrimaryButton
        label="Retour à la connexion"
        onPress={() => navigation.navigate("SignIn")}
        style={{ marginTop: 20 }}
      />
      <PrimaryButton
        label="Accueil"
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
