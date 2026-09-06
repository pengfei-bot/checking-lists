import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";
import { PrimaryButton } from "../components/PrimaryButton";
import { formatFrenchDate, todayISO } from "../utils/dates";

type Props = NativeStackScreenProps<RootStackParamList, "ProfilePicker">;

export function ProfilePickerScreen({ navigation }: Props) {
  const { ready, state, setCurrentProfileId, resetDemo } = useApp();
  const { session, isDemo, isAuthenticated, family, signOut } = useAuth();

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loading}>Chargement de la démo…</Text>
      </View>
    );
  }

  const parents = state.profiles.filter((p) => p.role === "parent");
  const kids = state.profiles.filter((p) => p.role === "child");

  const enter = (id: string, role: "parent" | "child") => {
    setCurrentProfileId(id);
    navigation.replace(role === "parent" ? "ParentDashboard" : "ChildHome");
  };

  const onReset = () => {
    Alert.alert(
      "Réinitialiser la démo ?",
      "Les données locales seront remplacées par le jeu de démo (parent + Léo + Mia).",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Réinitialiser",
          style: "destructive",
          onPress: () => {
            void resetDemo();
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.emoji}>✅</Text>
      <Text style={styles.title}>Checking Lists</Text>
      <Text style={styles.subtitle}>
        Listes de tâches famille · {formatFrenchDate(todayISO())}
      </Text>
      <Text style={styles.hint}>
        {isDemo
          ? "Mode démo — données seed (Parent, Léo, Mia). Choisissez un profil."
          : isAuthenticated
            ? `Connecté : ${session?.displayName ?? session?.email ?? "parent"}${
                family?.inviteCode ? ` · code famille ${family.inviteCode}` : ""
              }`
            : session?.linkedViaInvite
              ? `Appareil lié à « ${session.displayName ?? "famille"} » — choisissez un profil enfant.`
              : "Choisissez un profil pour commencer."}
      </Text>

      <Text style={styles.section}>Parent</Text>
      {parents.map((p) => (
        <Pressable
          key={p.id}
          style={({ pressed }) => [styles.card, { borderColor: p.color, opacity: pressed ? 0.85 : 1 }]}
          onPress={() => enter(p.id, "parent")}
        >
          <Text style={styles.cardEmoji}>{p.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{p.name}</Text>
            <Text style={styles.cardMeta}>Tableau de bord · gérer les enfants</Text>
          </View>
        </Pressable>
      ))}

      <Text style={styles.section}>Enfants</Text>
      {kids.map((p) => (
        <Pressable
          key={p.id}
          style={({ pressed }) => [styles.card, { borderColor: p.color, opacity: pressed ? 0.85 : 1 }]}
          onPress={() => enter(p.id, "child")}
        >
          <Text style={styles.cardEmoji}>{p.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{p.name}</Text>
            <Text style={styles.cardMeta}>Mes tâches du jour · photo preuve</Text>
          </View>
        </Pressable>
      ))}

      {isAuthenticated ? (
        <PrimaryButton
          label="Partage famille (code invitation)"
          variant="secondary"
          onPress={() => navigation.navigate("FamilyShare")}
          style={{ marginTop: 24 }}
        />
      ) : null}

      <PrimaryButton
        label="Réinitialiser les données de démo"
        variant="ghost"
        onPress={onReset}
        style={{ marginTop: isAuthenticated ? 10 : 24 }}
      />

      <PrimaryButton
        label={session ? "Se déconnecter / quitter" : "Retour à l'accueil"}
        variant="ghost"
        onPress={() => {
          void (async () => {
            await signOut();
            navigation.replace("Welcome");
          })();
        }}
        style={{ marginTop: 10 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  loading: { marginTop: 12, color: colors.textMuted },
  container: { padding: 20, paddingBottom: 40, backgroundColor: colors.bg, flexGrow: 1 },
  emoji: { fontSize: 42, textAlign: "center", marginTop: 12 },
  title: { fontSize: 28, fontWeight: "800", textAlign: "center", color: colors.text, marginTop: 8 },
  subtitle: { textAlign: "center", color: colors.textMuted, marginTop: 4, textTransform: "capitalize" },
  hint: {
    marginTop: 16,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    padding: 12,
    borderRadius: 12,
    overflow: "hidden",
    fontWeight: "600",
    textAlign: "center",
  },
  section: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardEmoji: { fontSize: 32 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  cardMeta: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
});
