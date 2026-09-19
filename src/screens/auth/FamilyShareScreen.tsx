import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../auth";
import { FamilyJoinRequest } from "../../auth/types";
import { PrimaryButton } from "../../components/PrimaryButton";
import { RootStackParamList } from "../../navigation/types";
import { useParentOnlyGuard } from "../../navigation/useParentOnlyGuard";
import { useTranslation } from "react-i18next";
import { colors } from "../../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "FamilyShare">;

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(text);
        return true;
      }
    }
    await Share.share({ message: text });
    return true;
  } catch {
    return false;
  }
}

export function FamilyShareScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const blocked = useParentOnlyGuard(navigation);
  const {
    family,
    session,
    isAuthenticated,
    createInvite,
    isDemo,
    listJoinRequests,
    approveJoinRequest,
    refuseJoinRequest,
  } = useAuth();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(family?.inviteCode ?? "");
  const [requests, setRequests] = useState<FamilyJoinRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!isAuthenticated || isDemo) {
      setRequests([]);
      return;
    }
    setRequestsLoading(true);
    try {
      setRequests(await listJoinRequests());
    } catch {
      /* keep previous */
    } finally {
      setRequestsLoading(false);
    }
  }, [isAuthenticated, isDemo, listJoinRequests]);

  useFocusEffect(
    useCallback(() => {
      void loadRequests();
    }, [loadRequests])
  );

  const onCopy = async () => {
    const value = code || family?.inviteCode || "";
    if (!value || value === "————") {
      Alert.alert(t("common.error"), t("familyShare.copyEmpty"));
      return;
    }
    const ok = await copyToClipboard(value);
    if (ok) {
      Alert.alert(t("familyShare.copiedTitle"), t("familyShare.copiedMsg", { code: value }));
    } else {
      Alert.alert(t("common.error"), t("familyShare.copyFailed"));
    }
  };

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

  const confirmRefresh = () => {
    Alert.alert(t("familyShare.confirmRegenTitle"), t("familyShare.confirmRegenBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("familyShare.generate"), style: "destructive", onPress: () => void onRefresh() },
    ]);
  };

  const onApprove = async (id: string) => {
    setActionId(id);
    try {
      await approveJoinRequest(id);
      await loadRequests();
      Alert.alert(t("joinRequests.approvedTitle"), t("joinRequests.approvedBody"));
    } catch (e) {
      Alert.alert(t("common.error"), e instanceof Error ? e.message : t("joinRequests.actionFailed"));
    } finally {
      setActionId(null);
    }
  };

  const onRefuse = (id: string) => {
    Alert.alert(t("joinRequests.refuseTitle"), t("joinRequests.refuseBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("joinRequests.refuse"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setActionId(id);
            try {
              await refuseJoinRequest(id);
              await loadRequests();
            } catch (e) {
              Alert.alert(
                t("common.error"),
                e instanceof Error ? e.message : t("joinRequests.actionFailed")
              );
            } finally {
              setActionId(null);
            }
          })();
        },
      },
    ]);
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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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
        label={t("familyShare.copyCode")}
        variant="secondary"
        onPress={() => void onCopy()}
        style={{ marginTop: 16 }}
      />
      <PrimaryButton
        label={t("familyShare.generate")}
        loading={busy}
        onPress={confirmRefresh}
        style={{ marginTop: 10 }}
      />

      <Text style={styles.sectionTitle}>{t("joinRequests.title")}</Text>
      <Text style={styles.sectionHint}>{t("joinRequests.hint")}</Text>

      {requestsLoading && requests.length === 0 ? (
        <Text style={styles.empty}>{t("common.loading")}</Text>
      ) : requests.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>{t("joinRequests.empty")}</Text>
        </View>
      ) : (
        requests.map((req) => (
          <View key={req.id} style={styles.requestCard}>
            <Text style={styles.requestName}>{req.displayName}</Text>
            <Text style={styles.requestMeta}>
              {t("joinRequests.requestedAt", {
                date: new Date(req.createdAt).toLocaleString(),
              })}
            </Text>
            <View style={styles.requestActions}>
              <PrimaryButton
                label={t("joinRequests.approve")}
                loading={actionId === req.id}
                onPress={() => void onApprove(req.id)}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label={t("joinRequests.refuse")}
                variant="ghost"
                loading={actionId === req.id}
                onPress={() => onRefuse(req.id)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ))
      )}

      <PrimaryButton
        label={t("common.back")}
        variant="ghost"
        onPress={() => navigation.goBack()}
        style={{ marginTop: 16, marginBottom: 24 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.parentBg, padding: 20 },
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
  sectionTitle: {
    marginTop: 28,
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  sectionHint: { color: colors.textMuted, marginTop: 4, marginBottom: 12, lineHeight: 20 },
  emptyBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  empty: { color: colors.textMuted, textAlign: "center" },
  requestCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestName: { fontSize: 16, fontWeight: "800", color: colors.text },
  requestMeta: { color: colors.textMuted, marginTop: 4, marginBottom: 10, fontSize: 13 },
  requestActions: { flexDirection: "row", gap: 8 },
});
