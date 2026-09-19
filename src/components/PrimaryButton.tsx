import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors } from "../theme/colors";

interface Props {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  large?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  large,
  style,
  accessibilityLabel,
}: Props) {
  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "danger"
        ? colors.danger
        : variant === "secondary"
          ? colors.primarySoft
          : "transparent";
  const color =
    variant === "primary" || variant === "danger"
      ? "#fff"
      : variant === "secondary"
        ? colors.primary
        : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      // RN Web: explicit role + pointer cursor so CTAs work in incognito / trackpads
      {...(Platform.OS === "web" ? ({ role: "button" } as object) : null)}
      style={({ pressed }) => [
        styles.btn,
        large && styles.btnLarge,
        Platform.OS === "web" && styles.btnWeb,
        { backgroundColor: bg, opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1 },
        variant === "ghost" && styles.ghost,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.label, large && styles.labelLarge, { color }]} pointerEvents="none">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnWeb: {
    cursor: "pointer" as unknown as undefined,
    userSelect: "none" as unknown as undefined,
  },
  btnLarge: {
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  ghost: { borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 15, fontWeight: "700" },
  labelLarge: { fontSize: 20, fontWeight: "800" },
});
