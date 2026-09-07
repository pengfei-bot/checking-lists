import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../auth";
import { WebLimitBanner } from "../components/WebLimitBanner";
import { ChildFormScreen } from "../screens/ChildFormScreen";
import { ChildHistoryScreen } from "../screens/ChildHistoryScreen";
import { ChildHomeScreen } from "../screens/ChildHomeScreen";
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

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.bootText}>Chargement…</Text>
      </View>
    );
  }

  const initial = session ? "ProfilePicker" : "Welcome";

  return (
    <View style={styles.root}>
      <WebLimitBanner />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initial}
          screenOptions={{
            headerStyle: { backgroundColor: colors.card },
            headerTitleStyle: { fontWeight: "700" },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="SignUp"
            component={SignUpScreen}
            options={{ title: "Créer un compte" }}
          />
          <Stack.Screen
            name="SignIn"
            component={SignInScreen}
            options={{ title: "Connexion" }}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{ title: "Mot de passe oublié" }}
          />
          <Stack.Screen
            name="RedeemInvite"
            component={RedeemInviteScreen}
            options={{ title: "Code famille" }}
          />
          <Stack.Screen
            name="FamilyShare"
            component={FamilyShareScreen}
            options={{ title: "Partage famille" }}
          />
          <Stack.Screen
            name="ProfilePicker"
            component={ProfilePickerScreen}
            options={{ title: "Qui es-tu ?", headerShown: false }}
          />
          <Stack.Screen
            name="ChildHome"
            component={ChildHomeScreen}
            options={{ title: "Mes taches" }}
          />
          <Stack.Screen
            name="ChildHistory"
            component={ChildHistoryScreen}
            options={{ title: "Historique" }}
          />
          <Stack.Screen
            name="ParentDashboard"
            component={ParentDashboardScreen}
            options={{ title: "Parents" }}
          />
          <Stack.Screen
            name="ParentCalendar"
            component={ParentCalendarScreen}
            options={{ title: "Calendrier" }}
          />
          <Stack.Screen
            name="ParentDayDetail"
            component={ParentDayDetailScreen}
            options={{ title: "Jour" }}
          />
          <Stack.Screen
            name="TaskForm"
            component={TaskFormScreen}
            options={{ title: "Tache", presentation: "modal" }}
          />
          <Stack.Screen
            name="TaskDetail"
            component={TaskDetailScreen}
            options={{ title: "Detail" }}
          />
          <Stack.Screen
            name="ChildForm"
            component={ChildFormScreen}
            options={{ title: "Enfant", presentation: "modal" }}
          />
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
