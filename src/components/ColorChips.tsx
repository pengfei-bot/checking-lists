import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { childColors } from "../theme/colors";

type Props = {
  value: string;
  onChange: (color: string) => void;
  colors?: string[];
};

/** M5 circular color pastilles — selected chip shows a white checkmark. */
export function ColorChips({ value, onChange, colors = childColors }: Props) {
  return (
    <View style={styles.row}>
      {colors.map((c) => {
        const selected = value === c;
        return (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.chip, { backgroundColor: c }, selected && styles.chipSelected]}
          >
            {selected ? <Text style={styles.check}>✓</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  chipSelected: {
    borderColor: "#ffffffaa",
    transform: [{ scale: 1.06 }],
  },
  check: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
