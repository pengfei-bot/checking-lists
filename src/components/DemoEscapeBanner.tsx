import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth";
import { colors } from "../theme/colors";

interface Props {
  onEscape: () => void;
}

/** Persistent banner while isDemo so cloud SignIn/SignUp never disappears. */
export function DemoEscapeBanner({ onEscape }: Props) {
  const { t } = useTranslation();
  const { isDemo } = useAuth();
  if (!isDemo) return null;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.text}>{t("demoEscape.message")}</Text>
      <Pressable
        onPress={onEscape}
        hitSlop={8}
        accessibilityRole="button"
        style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.75 : 1 }]}
      >
        <Text style={styles.ctaText}>{t("demoEscape.cta")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.primarySoft,
    borderBottomWidth: 1,
    borderBottomColor: "#C9D4FF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  text: {
    flex: 1,
    color: colors.text,
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },
});
