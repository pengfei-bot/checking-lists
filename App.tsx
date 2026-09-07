import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/auth";
import { AppProvider } from "./src/context/AppContext";
import { I18nProvider } from "./src/i18n";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { applyAppFonts } from "./src/theme/fonts";

applyAppFonts();

export default function App() {
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
