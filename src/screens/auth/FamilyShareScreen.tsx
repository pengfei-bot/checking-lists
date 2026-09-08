import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../auth";
import { PrimaryButton } from "../../components/PrimaryButton";
import { RootStackParamList } from "../../navigation/types";
import { useParentOnlyGuard } from "../../navigation/useParentOnlyGuard";
import { useTranslation } from "react-i18next";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "FamilyShare">;

export function FamilyShareScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const blocked = useParentOnlyGuard(navigation);
  const { family, session, isAuthenticated, createInvite, isDemo } = useAuth();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(family?.inviteCode ?? "");

  const onRefresh = async () => {
    setBusy(true);
    try {
      const invite = await createInvite();
      setCode(invite.code);
      Alert.alert(t("familyShare.newCodeTitle"), t("familyShare.newCodeMsg", { code: invite.code }));
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error ? e.message : t("familyShare.generateFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (blocked) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t("familyShare.parentSpace")}</Text>
        <Text style={styles.body}>{t("familyShare.blockedBody")}</Text>
        <PrimaryButton
          label={t("common.back")}
          variant="ghost"
          onPress={() => navigation.reset({ index: 0, routes: [{ name: "ProfilePicker" }] })}
          style={{ marginTop: 16 }}
        />
      </View>
    );
  }

  if (isDemo || !isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t("familyShare.title")}</Text>
        <Text style={styles.body}>{t("familyShare.demoBody")}</Text>
        <PrimaryButton
          label={t("familyShare.createParent")}
          onPress={() => navigation.navigate("SignUp")}
          style={{ marginTop: 16 }}
        />
      </View>
    );
  }

  const displayCode = code || family?.inviteCode || "————";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("familyShare.title")}</Text>
      <Text style={styles.subtitle}>{family?.name ?? t("familyShare.yourFamily")}</Text>
      <Text style={styles.body}>{t("familyShare.body")}</Text>

      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>{t("familyShare.inviteCode")}</Text>
        <Text style={styles.code}>{displayCode}</Text>
      </View>

      {session?.email ? (
        <Text style={styles.meta}>{t("familyShare.account", { email: session.email })}</Text>
      ) : null}

      <PrimaryButton
        label={t("familyShare.generate")}
        loading={busy}
        onPress={() => void onRefresh()}
        style={{ marginTop: 16 }}
      />
      <PrimaryButton
        label={t("common.back")}
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
