import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "./types";
import { ProfilePickerScreen } from "../screens/ProfilePickerScreen";
import { ChildHomeScreen } from "../screens/ChildHomeScreen";
import { ParentDashboardScreen } from "../screens/ParentDashboardScreen";
import { TaskFormScreen } from "../screens/TaskFormScreen";
import { TaskDetailScreen } from "../screens/TaskDetailScreen";
import { colors } from "../theme/colors";
import { WebLimitBanner } from "../components/WebLimitBanner";
import { View, StyleSheet } from "react-native";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <View style={styles.root}>
      <WebLimitBanner />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="ProfilePicker"
          screenOptions={{
            headerStyle: { backgroundColor: colors.card },
            headerTitleStyle: { fontWeight: "700" },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
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
            name="ParentDashboard"
            component={ParentDashboardScreen}
            options={{ title: "Parents" }}
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
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
