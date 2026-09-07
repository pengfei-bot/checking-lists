import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/auth";
import { AppProvider } from "./src/context/AppContext";
import { I18nProvider } from "./src/i18n";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { applyAppFonts } from "./src/theme/fonts";
import { colors } from "./src/theme/colors";

export default function App() {
  const [fontsReady, setFontsReady] = useState(Platform.OS !== "web");

  useEffect(() => {
    let cancelled = false;
    void applyAppFonts().then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!fontsReady) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <AppProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </AppProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
