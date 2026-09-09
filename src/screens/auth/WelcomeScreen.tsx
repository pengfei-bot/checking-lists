import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  const [demoBusy, setDemoBusy] = React.useState(false);

  React.useEffect(() => {
    if (ready && session) {
      navigation.reset({ index: 0, routes: [{ name: "ProfilePicker" }] });
    }
  }, [ready, session, navigation]);

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
      <Image
        source={require("../../../assets/icon.png")}
        style={styles.logo}
        accessibilityLabel="Famlist"
      />
      <Text style={styles.title}>Famlist</Text>
      <Text style={styles.subtitle}>{t("welcome.subtitle")}</Text>

      <View style={[styles.roleCard, styles.parentCard]}>
        <Text style={styles.roleEmoji}>👨‍👩‍👧</Text>
        <Text style={styles.roleTitle}>{t("welcome.parentTitle")}</Text>
        <Text style={styles.roleHint}>{t("welcome.parentHint")}</Text>
        <PrimaryButton
          label={t("welcome.signInParent")}
          onPress={() => navigation.navigate("SignIn")}
          style={{ marginTop: 12 }}
        />
        <Pressable
          onPress={() => navigation.navigate("SignUp")}
          style={({ pressed }) => [styles.linkBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.linkText}>{t("welcome.createParent")}</Text>
        </Pressable>
      </View>

      <View style={[styles.roleCard, styles.childCard]}>
        <Text style={styles.roleEmoji}>🧒</Text>
        <Text style={styles.roleTitle}>{t("welcome.childTitle")}</Text>
        <Text style={styles.roleHint}>{t("welcome.childHint")}</Text>
        <PrimaryButton
          label={t("welcome.joinFamily")}
          variant="secondary"
          onPress={() => navigation.navigate("RedeemInvite")}
          style={{ marginTop: 12 }}
        />
      </View>

      <PrimaryButton
        label={t("welcome.continueDemo")}
        variant="ghost"
        loading={demoBusy}
        onPress={() => {
          void (async () => {
            setDemoBusy(true);
            try {
              await continueAsDemo();
              navigation.reset({ index: 0, routes: [{ name: "ProfilePicker" }] });
            } finally {
              setDemoBusy(false);
            }
          })();
        }}
        style={{ marginTop: 4 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  muted: { marginTop: 12, color: colors.textMuted },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: "center",
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 8,
  },
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
    marginBottom: 22,
  },
  roleCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  parentCard: {
    backgroundColor: colors.parentBg,
    borderColor: "#D6E6FF",
  },
  childCard: {
    backgroundColor: colors.kidBg,
    borderColor: "#FFE0C2",
  },
  roleEmoji: { fontSize: 28, marginBottom: 6 },
  roleTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  roleHint: {
    marginTop: 6,
    color: colors.textMuted,
    lineHeight: 20,
    fontSize: 14,
  },
  linkBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 6,
  },
  linkText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 15,
  },
});
