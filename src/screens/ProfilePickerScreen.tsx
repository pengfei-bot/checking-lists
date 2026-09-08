import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth";
import { useApp } from "../context/AppContext";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";
import { PrimaryButton } from "../components/PrimaryButton";
import { formatLocalizedDate, todayISO } from "../utils/dates";
import { confirmUser, notifyUser } from "../utils/feedback";

type Props = NativeStackScreenProps<RootStackParamList, "ProfilePicker">;

export function ProfilePickerScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { ready, state, setCurrentProfileId, resetDemo } = useApp();
  const { session, isDemo, isAuthenticated, isChildDevice, family, signOut } = useAuth();

  const parents = state.profiles.filter((p) => p.role === "parent");
  const kids = state.profiles.filter((p) => p.role === "child");
  const singleChildId = kids.length === 1 ? kids[0].id : null;

  // Resume last profile (and always auto-enter when this device is a child with one kid).
  useEffect(() => {
    if (!ready) return;
    if (isChildDevice && singleChildId) {
      if (state.currentProfileId !== singleChildId) setCurrentProfileId(singleChildId);
      navigation.reset({ index: 0, routes: [{ name: "ChildHome" }] });
      return;
    }
    const remembered = state.profiles.find((p) => p.id === state.currentProfileId);
    if (!remembered) return;
    navigation.reset({
      index: 0,
      routes: [{ name: remembered.role === "parent" ? "ParentDashboard" : "ChildHome" }],
    });
  }, [
    ready,
    isChildDevice,
    singleChildId,
    state.currentProfileId,
    state.profiles,
    navigation,
    setCurrentProfileId,
  ]);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loading}>{t("profiles.loading")}</Text>
      </View>
    );
  }

  const demoRoster = [
    ...parents.map((p) => p.name.replace(/\s*\(Demo\)\s*/i, "").trim() || p.name),
    ...kids.map((k) => k.name),
  ].filter(Boolean);
  const demoBanner =
    demoRoster.length > 0
      ? t("profiles.demoBannerNamed", { names: demoRoster.join(", ") })
      : t("profiles.demoBanner");

  const enter = (id: string, role: "parent" | "child") => {
    if (isChildDevice && role === "parent") return;
    setCurrentProfileId(id);
    navigation.reset({
      index: 0,
      routes: [{ name: role === "parent" ? "ParentDashboard" : "ChildHome" }],
    });
  };

  const onReset = () => {
    void (async () => {
      const ok = await confirmUser(
        t("profiles.resetTitle"),
        t("profiles.resetBody"),
        t("profiles.resetConfirm")
      );
      if (!ok) return;
      await resetDemo();
      notifyUser(t("profiles.resetDoneTitle"), t("profiles.resetDoneBody"));
    })();
  };

  const hint = isChildDevice
    ? t("profiles.hintChildDevice", {
        name: session?.displayName ?? family?.name ?? t("profiles.familyFallback"),
      })
    : isDemo
      ? demoBanner
      : isAuthenticated
        ? t("profiles.hintAuth", {
            name: session?.displayName ?? session?.email ?? t("profiles.parentFallback"),
            codePart: family?.inviteCode
              ? t("profiles.hintAuthCode", { code: family.inviteCode })
              : "",
          })
        : t("profiles.hintDefault");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={require("../../assets/icon.png")} style={styles.logo} accessibilityLabel={t("common.appName")} />
      <Text style={styles.title}>{t("common.appName")}</Text>
      <Text style={styles.subtitle}>
        {isChildDevice
          ? t("profiles.subtitleChild", { date: formatLocalizedDate(todayISO(), i18n.language) })
          : t("profiles.subtitleFamily", { date: formatLocalizedDate(todayISO(), i18n.language) })}
      </Text>
      <Text style={styles.hint}>{hint}</Text>

      {!isChildDevice ? (
        <>
          <Text style={styles.section}>{t("profiles.sectionParent")}</Text>
          {parents.map((p) => (
            <Pressable
              key={p.id}
              style={({ pressed }) => [
                styles.card,
                { borderColor: p.color, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => enter(p.id, "parent")}
            >
              <Text style={styles.cardEmoji}>{p.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{p.name}</Text>
                <Text style={styles.cardMeta}>{t("profiles.parentMeta")}</Text>
              </View>
            </Pressable>
          ))}
        </>
      ) : null}

      <Text style={styles.section}>
        {isChildDevice ? t("profiles.sectionWho") : t("profiles.sectionChildren")}
      </Text>
      {kids.length === 0 ? (
        <Text style={styles.emptyKids}>
          {isChildDevice ? t("profiles.noKidsChild") : t("profiles.noKidsParent")}
        </Text>
      ) : (
        kids.map((p) => (
          <Pressable
            key={p.id}
            style={({ pressed }) => [
              styles.card,
              { borderColor: p.color, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => enter(p.id, "child")}
          >
            <Text style={styles.cardEmoji}>{p.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{p.name}</Text>
              <Text style={styles.cardMeta}>{t("profiles.childMeta")}</Text>
            </View>
          </Pressable>
        ))
      )}

      <PrimaryButton
        label={t("common.language")}
        variant="secondary"
        onPress={() => navigation.navigate("LanguageSettings")}
        style={{ marginTop: 24 }}
      />

      {isAuthenticated && !isChildDevice ? (
        <PrimaryButton
          label={t("profiles.shareInvite")}
          variant="secondary"
          onPress={() => navigation.navigate("FamilyShare")}
          style={{ marginTop: 10 }}
        />
      ) : null}

      {isDemo ? (
        <PrimaryButton
          label={t("profiles.resetDemo")}
          variant="ghost"
          onPress={onReset}
          style={{ marginTop: 10 }}
        />
      ) : null}

      <PrimaryButton
        label={session ? t("profiles.signOut") : t("profiles.backHome")}
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
  logo: { width: 72, height: 72, borderRadius: 16, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: "800", textAlign: "center", color: colors.text, marginTop: 8 },
  subtitle: {
    textAlign: "center",
    color: colors.textMuted,
    marginTop: 4,
    textTransform: "capitalize",
  },
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
  emptyKids: { color: colors.textMuted, marginBottom: 8, lineHeight: 20 },
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
