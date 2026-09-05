import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

export function WebLimitBanner() {
  if (Platform.OS !== "web") return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>
        Mode demo web: UI + donnees locales OK. Notifications = desactivees. Photo = file picker ou mock.
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
