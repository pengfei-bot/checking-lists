import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth";
import { PrimaryButton } from "../../components/PrimaryButton";
import { RootStackParamList } from "../../navigation/types";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "JoinPending">;

const POLL_MS = 4_000;

export function JoinPendingScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { session, signOut, refreshJoinRequest, isPendingJoin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef(false);

  const familyName = session?.pendingFamilyName || session?.displayName || t("joinPending.familyFallback");
  const refused = session?.joinStatus === "refused";

  const poll = useCallback(async () => {
    if (polling.current) return;
    polling.current = true;
    try {
      await refreshJoinRequest();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("joinPending.pollFailed"));
    } finally {
      polling.current = false;
    }
  }, [refreshJoinRequest, t]);

  useEffect(() => {
    if (!isPendingJoin) {
      if (session?.mode === "child_device") {
        navigation.reset({ index: 0, routes: [{ name: "ProfilePicker" }] });
      }
      return;
    }
    void poll();
    const id = setInterval(() => {
      void poll();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [isPendingJoin, session?.mode, navigation, poll]);

  const onLeave = async () => {
    setBusy(true);
    try {
      await signOut();
      navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
    } finally {
      setBusy(false);
    }
  };

  const onRetry = () => {
    navigation.reset({ index: 0, routes: [{ name: "RedeemInvite" }] });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{refused ? "🚫" : "⏳"}</Text>
      <Text style={styles.title}>
        {refused ? t("joinPending.refusedTitle") : t("joinPending.title")}
      </Text>
      <Text style={styles.body}>
        {refused
          ? t("joinPending.refusedBody", { family: familyName })
          : t("joinPending.body", { family: familyName })}
      </Text>

      {!refused ? (
        <View style={styles.waitRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.waitText}>{t("joinPending.waiting")}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {refused ? (
        <PrimaryButton
          label={t("joinPending.tryAgain")}
          onPress={onRetry}
          style={{ marginTop: 20 }}
        />
      ) : (
        <PrimaryButton
          label={t("joinPending.refresh")}
          variant="secondary"
          loading={busy}
          onPress={() => void poll()}
          style={{ marginTop: 20 }}
        />
      )}

      <PrimaryButton
        label={t("joinPending.leave")}
        variant="ghost"
        loading={busy}
        onPress={() => void onLeave()}
        style={{ marginTop: 10 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: "center",
  },
  emoji: { fontSize: 48, textAlign: "center", marginBottom: 12 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    color: colors.textMuted,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 16,
  },
  waitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  waitText: { color: colors.primary, fontWeight: "700" },
  error: {
    marginTop: 12,
    color: colors.danger,
    fontWeight: "600",
    backgroundColor: "#FEECEC",
    padding: 10,
    borderRadius: 10,
    textAlign: "center",
  },
});
