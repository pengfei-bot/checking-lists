import React, { useState } from "react";
import {
  Alert,
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
import { BuildStamp } from "../components/BuildStamp";
import { ParentRewardsBottomNav } from "../components/RewardsBottomNav";
import { PrimaryButton } from "../components/PrimaryButton";
import { RootStackParamList } from "../navigation/types";
import { useParentOnlyGuard } from "../navigation/useParentOnlyGuard";
import { addTodayTasksToCalendar, calendarSupported } from "../services/calendar";
import {
  ensureNotificationPermissions,
  notificationsSupported,
} from "../services/notifications";
import { colors } from "../theme/colors";
import { rewardsUi } from "../theme/rewardsUi";
import { confirmUser, notifyUser } from "../utils/feedback";

type Props = NativeStackScreenProps<RootStackParamList, "ParentSettings">;

function SettingsRow({
  label,
  onPress,
  destructive,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDanger]}>{label}</Text>
      <Text style={[styles.chevron, destructive && styles.rowLabelDanger]}>›</Text>
    </Pressable>
  );
}

export function ParentSettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const blocked = useParentOnlyGuard(navigation);
  const { currentProfile, state, setCurrentProfileId, refreshReminders } = useApp();
  const { isAuthenticated, deleteAccount } = useAuth();
  const [deletingAccount, setDeletingAccount] = useState(false);

  if (blocked || !currentProfile || currentProfile.role !== "parent") {
    return (
      <View style={styles.center}>
        <Text>{blocked ? t("roles.parentOnly") : t("roles.parentRequired")}</Text>
        <PrimaryButton
          label={t("common.changeProfile")}
          onPress={() => {
            setCurrentProfileId(null);
            navigation.replace("ProfilePicker", { mode: "switch" });
          }}
          style={{ marginTop: 12 }}
        />
      </View>
    );
  }

  const onReminders = async () => {
    if (!notificationsSupported()) {
      Alert.alert(t("notifications.title"), t("notifications.webUnavailableParent"));
      return;
    }
    const ok = await ensureNotificationPermissions();
    if (!ok) {
      Alert.alert(t("notifications.deniedTitle"), t("notifications.deniedBodyShort"));
      return;
    }
    const n = await refreshReminders();
    Alert.alert(
      t("notifications.remindersTitle"),
      t("notifications.remindersScheduledShort", { count: n })
    );
  };

  const onCalendar = async () => {
    const result = await addTodayTasksToCalendar(state.tasks, state.profiles);
    Alert.alert(t("deviceCalendar.title"), result.message);
  };

  const onDeleteAccount = () => {
    void (async () => {
      const step1 = await confirmUser(
        t("account.deleteTitle"),
        t("account.deleteBody"),
        t("account.deleteConfirm")
      );
      if (!step1) return;
      const step2 = await confirmUser(
        t("account.deleteFinalTitle"),
        t("account.deleteFinalBody"),
        t("account.deleteFinalConfirm")
      );
      if (!step2) return;
      setDeletingAccount(true);
      try {
        await deleteAccount();
        navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
      } catch (e) {
        notifyUser(
          t("common.error"),
          e instanceof Error ? e.message : t("account.deleteFailed")
        );
      } finally {
        setDeletingAccount(false);
      }
    })();
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t("parentSettings.title")}</Text>
        <Text style={styles.subtitle}>{t("parentSettings.subtitle")}</Text>

        <View style={styles.group}>
          <SettingsRow
            label={t("common.language")}
            onPress={() => navigation.navigate("LanguageSettings")}
          />
          <View style={styles.sep} />
          <SettingsRow
            label={t("common.changeProfile")}
            onPress={() => {
              setCurrentProfileId(null);
              navigation.replace("ProfilePicker", { mode: "switch" });
            }}
          />
        </View>

        <View style={styles.group}>
          <SettingsRow
            label={t("familyShare.title")}
            onPress={() => {
              if (isAuthenticated) {
                navigation.navigate("FamilyShare");
              } else {
                navigation.navigate("SignUp");
              }
            }}
          />
        </View>

        <View style={styles.group}>
          <SettingsRow
            label={t("parentDash.reminders")}
            onPress={() => {
              void onReminders();
            }}
          />
          {calendarSupported() ? (
            <>
              <View style={styles.sep} />
              <SettingsRow
                label={t("parentDash.addCalendar")}
                onPress={() => {
                  void onCalendar();
                }}
              />
            </>
          ) : null}
        </View>

        {isAuthenticated ? (
          <View style={styles.group}>
            <SettingsRow
              label={deletingAccount ? t("common.loading") : t("account.delete")}
              onPress={onDeleteAccount}
              destructive
            />
          </View>
        ) : null}
      </ScrollView>
      <BuildStamp />
      <ParentRewardsBottomNav navigation={navigation} active="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: rewardsUi.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  container: { padding: 16, paddingBottom: 28 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: 16 },
  group: {
    backgroundColor: colors.card,
    borderRadius: 14,
    marginBottom: 14,
    overflow: "hidden",
    ...rewardsUi.shadow,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 52,
    gap: 8,
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.text },
  rowLabelDanger: { color: colors.danger },
  chevron: { fontSize: 22, color: colors.textMuted, fontWeight: "300", marginTop: -2 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 16 },
});
