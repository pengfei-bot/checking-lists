import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../auth";
import { PrimaryButton } from "../../components/PrimaryButton";
import { RootStackParamList } from "../../navigation/types";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "FamilyShare">;

export function FamilyShareScreen({ navigation }: Props) {
  const { family, session, isAuthenticated, createInvite, isDemo } = useAuth();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(family?.inviteCode ?? "");

  const onRefresh = async () => {
    setBusy(true);
    try {
      const invite = await createInvite();
      setCode(invite.code);
      Alert.alert("Nouveau code", `Code famille : ${invite.code}`);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Impossible de générer le code.");
    } finally {
      setBusy(false);
    }
  };

  if (isDemo || !isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Partage famille</Text>
        <Text style={styles.body}>
          Disponible après création d'un compte parent. En mode démo, utilisez les profils seed
          (profils enfants seed) sur le même appareil.
        </Text>
        <PrimaryButton
          label="Créer un compte parent"
          onPress={() => navigation.navigate("SignUp")}
          style={{ marginTop: 16 }}
        />
      </View>
    );
  }

  const displayCode = code || family?.inviteCode || "————";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Partage famille</Text>
      <Text style={styles.subtitle}>{family?.name ?? "Votre famille"}</Text>
      <Text style={styles.body}>
        Donnez ce code à un appareil « enfant » pour le lier localement à votre famille. Modèle
        prototype — le cloud remplacera le partage multi-appareils.
      </Text>

      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>Code d'invitation</Text>
        <Text style={styles.code}>{displayCode}</Text>
      </View>

      {session?.email ? (
        <Text style={styles.meta}>Compte : {session.email}</Text>
      ) : null}

      <PrimaryButton
        label="Générer un nouveau code"
        loading={busy}
        onPress={() => void onRefresh()}
        style={{ marginTop: 16 }}
      />
      <PrimaryButton
        label="Retour"
        variant="ghost"
        onPress={() => navigation.goBack()}
        style={{ marginTop: 10 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.parentBg, padding: 20 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  subtitle: { color: colors.primary, fontWeight: "700", marginTop: 4, marginBottom: 12 },
  body: { color: colors.textMuted, lineHeight: 21, marginBottom: 20 },
  codeBox: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.primary,
  },
  codeLabel: { color: colors.textMuted, fontWeight: "700", marginBottom: 8 },
  code: {
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 6,
    color: colors.primary,
  },
  meta: { marginTop: 12, color: colors.textMuted, textAlign: "center" },
});
