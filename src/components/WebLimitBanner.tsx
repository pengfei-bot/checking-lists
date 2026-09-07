import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/colors";

export function WebLimitBanner() {
  const { t } = useTranslation();
  if (Platform.OS !== "web") return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>
        {t("webBanner.text")}
      </Text>
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
