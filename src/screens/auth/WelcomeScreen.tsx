import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../auth";
import { PrimaryButton } from "../../components/PrimaryButton";
import { RootStackParamList } from "../../navigation/types";
import { useTranslation } from "react-i18next";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { ready, session, continueAsDemo } = useAuth();
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (ready && session) {
      navigation.replace("ProfilePicker");
    }
  }, [ready, session, navigation]);

  const onDemo = async () => {
    setBusy(true);
    try {
      await continueAsDemo();
      navigation.replace("ProfilePicker");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>{t("common.loading")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>✅</Text>
      <Text style={styles.title}>Checking Lists</Text>
      <Text style={styles.subtitle}>{t("welcome.subtitle")}</Text>

      <View style={styles.card}>
        <Text style={styles.badge}>{t("welcome.badge")}</Text>
        <Text style={styles.cardText}>
          {t("welcome.cardText")}
        </Text>
      </View>

      <PrimaryButton
        label={t("welcome.joinFamily")}
        onPress={() => navigation.navigate("RedeemInvite")}
        style={{ marginTop: 8 }}
      />
      <PrimaryButton
        label={t("welcome.createParent")}
        variant="secondary"
        onPress={() => navigation.navigate("SignUp")}
        style={{ marginTop: 10 }}
      />
      <PrimaryButton
        label={t("welcome.signInParent")}
        variant="ghost"
        onPress={() => navigation.navigate("SignIn")}
        style={{ marginTop: 10 }}
      />
      <PrimaryButton
        label={t("welcome.continueDemo")}
        variant="ghost"
        loading={busy}
        onPress={() => void onDemo()}
        style={{ marginTop: 18 }}
      />
      <Text style={styles.footer}>
        {t("welcome.footer")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  muted: { marginTop: 12, color: colors.textMuted },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: "center",
  },
  emoji: { fontSize: 48, textAlign: "center" },
  title: {
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    color: colors.text,
    marginTop: 8,
  },
  subtitle: {
    textAlign: "center",
    color: colors.textMuted,
    marginTop: 10,
    lineHeight: 22,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    color: "#fff",
    fontWeight: "800",
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 8,
  },
  cardText: { color: colors.primary, fontWeight: "600", lineHeight: 20 },
  footer: {
    marginTop: 16,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
