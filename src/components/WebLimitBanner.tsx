import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth";
import { colors } from "../theme/colors";

/** Web-only capability notice — must not claim "demo" when session is cloud. */
export function WebLimitBanner() {
  const { t } = useTranslation();
  const { isDemo, isCloud } = useAuth();
  if (Platform.OS !== "web") return null;
  const text = isDemo
    ? t("webBanner.demo")
    : isCloud
      ? t("webBanner.cloud")
      : t("webBanner.guest");
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#FFF4E5",
    borderBottomWidth: 1,
    borderBottomColor: "#FFD8A8",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: { color: "#9C5B00", fontSize: 12, textAlign: "center", lineHeight: 16 },
});
