import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth";
import { WebLimitBanner } from "../components/WebLimitBanner";
import { ChildDayDetailScreen } from "../screens/ChildDayDetailScreen";
import { ChildFormScreen } from "../screens/ChildFormScreen";
import { ChildHistoryScreen } from "../screens/ChildHistoryScreen";
import { ChildHomeScreen } from "../screens/ChildHomeScreen";
import { LanguageSettingsScreen } from "../screens/LanguageSettingsScreen";
import { ParentCalendarScreen } from "../screens/ParentCalendarScreen";
import { ParentDashboardScreen } from "../screens/ParentDashboardScreen";
import { ParentDayDetailScreen } from "../screens/ParentDayDetailScreen";
import { ProfilePickerScreen } from "../screens/ProfilePickerScreen";
import { TaskDetailScreen } from "../screens/TaskDetailScreen";
import { TaskFormScreen } from "../screens/TaskFormScreen";
import { FamilyShareScreen } from "../screens/auth/FamilyShareScreen";
import { ForgotPasswordScreen } from "../screens/auth/ForgotPasswordScreen";
import { RedeemInviteScreen } from "../screens/auth/RedeemInviteScreen";
import { SignInScreen } from "../screens/auth/SignInScreen";
import { SignUpScreen } from "../screens/auth/SignUpScreen";
import { WelcomeScreen } from "../screens/auth/WelcomeScreen";
import { colors } from "../theme/colors";
import { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { ready, session } = useAuth();
  const { t, i18n } = useTranslation();

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.bootText}>{t("common.loading")}</Text>
      </View>
    );
  }

  const initial = session ? "ProfilePicker" : "Welcome";

  return (
    <View style={styles.root}>
      <WebLimitBanner />
      <NavigationContainer key={i18n.language}>
        <Stack.Navigator
          initialRouteName={initial}
          screenOptions={{
            headerStyle: { backgroundColor: colors.card },
            headerTitleStyle: { fontWeight: "700" },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false, title: "Famlist" }} />
          <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: t("nav.signUp") }} />
          <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: t("nav.signIn") }} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: t("nav.forgotPassword") }} />
          <Stack.Screen name="RedeemInvite" component={RedeemInviteScreen} options={{ title: t("nav.redeemInvite") }} />
          <Stack.Screen name="FamilyShare" component={FamilyShareScreen} options={{ title: t("nav.familyShare") }} />
          <Stack.Screen name="ProfilePicker" component={ProfilePickerScreen} options={{ title: t("nav.whoAreYou"), headerShown: false }} />
          <Stack.Screen name="ChildHome" component={ChildHomeScreen} options={{ title: t("nav.childHome"), headerBackVisible: false }} />
          <Stack.Screen name="ChildHistory" component={ChildHistoryScreen} options={{ title: t("nav.childHistory") }} />
          <Stack.Screen name="ChildDayDetail" component={ChildDayDetailScreen} options={{ title: t("nav.childDay") }} />
          <Stack.Screen name="ParentDashboard" component={ParentDashboardScreen} options={{ title: t("nav.parentDashboard"), headerBackVisible: false }} />
          <Stack.Screen name="ParentCalendar" component={ParentCalendarScreen} options={{ title: t("nav.parentCalendar") }} />
          <Stack.Screen name="ParentDayDetail" component={ParentDayDetailScreen} options={{ title: t("nav.parentDay") }} />
          <Stack.Screen name="TaskForm" component={TaskFormScreen} options={{ title: t("nav.taskForm"), presentation: "modal" }} />
          <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: t("nav.taskDetail") }} />
          <Stack.Screen name="ChildForm" component={ChildFormScreen} options={{ title: t("nav.childForm"), presentation: "modal" }} />
          <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} options={{ title: t("nav.language") }} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  bootText: { marginTop: 12, color: colors.textMuted },
});
