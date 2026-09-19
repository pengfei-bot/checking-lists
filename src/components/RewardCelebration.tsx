import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { rewardsUi } from "../theme/rewardsUi";
import type { RewardUnitKind } from "../types";

export type RewardCelebrationProps = {
  /** Points / money amount awarded (must be > 0). */
  amount: number;
  unitKind: RewardUnitKind;
  /** Called after the animation finishes (or immediately if amount <= 0). */
  onFinished?: () => void;
  /** Total duration in ms (default ~1000). */
  durationMs?: number;
};

/** Symbol for floating bubble — matches ChildHome pill convention. */
export function rewardUnitSymbol(unitKind: RewardUnitKind): "⭐" | "€" {
  return unitKind === "money" ? "€" : "⭐";
}

type SparkleSpec = {
  dx: number;
  dy: number;
  size: number;
  delay: number;
  glyph: string;
};

const SPARKLES: SparkleSpec[] = [
  { dx: -22, dy: -18, size: 12, delay: 0, glyph: "✦" },
  { dx: 20, dy: -28, size: 10, delay: 40, glyph: "✧" },
  { dx: -8, dy: -36, size: 11, delay: 80, glyph: "✦" },
  { dx: 14, dy: -8, size: 9, delay: 60, glyph: "·" },
  { dx: -28, dy: -4, size: 9, delay: 100, glyph: "·" },
];

/**
 * Lightweight celebrate burst for rewarded task completes.
 * Uses RN Animated only (no Reanimated). Non-blocking overlay —
 * parent should fire after successful markTaskDone.
 */
export function RewardCelebration({
  amount,
  unitKind,
  onFinished,
  durationMs = 1000,
}: RewardCelebrationProps) {
  const rise = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;
  const sparkleAnims = useMemo(
    () => SPARKLES.map(() => ({ t: new Animated.Value(0) })),
    []
  );

  useEffect(() => {
    if (amount <= 0) {
      onFinished?.();
      return;
    }

    rise.setValue(0);
    fade.setValue(0);
    scale.setValue(0.6);
    sparkleAnims.forEach((s) => s.t.setValue(0));

    const bubble = Animated.parallel([
      Animated.timing(rise, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(fade, {
          toValue: 1,
          duration: Math.min(180, durationMs * 0.2),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 0,
          duration: durationMs * 0.55,
          delay: durationMs * 0.25,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.12,
          friction: 5,
          tension: 140,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]),
    ]);

    const sparkles = Animated.stagger(
      30,
      sparkleAnims.map((s, i) =>
        Animated.timing(s.t, {
          toValue: 1,
          duration: durationMs * 0.75,
          delay: SPARKLES[i].delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      )
    );

    const run = Animated.parallel([bubble, sparkles]);
    run.start(({ finished }) => {
      if (finished) onFinished?.();
    });

    return () => {
      run.stop();
    };
  }, [amount, durationMs, fade, onFinished, rise, scale, sparkleAnims]);

  if (amount <= 0) return null;

  const symbol = rewardUnitSymbol(unitKind);
  const label = `+${amount} ${symbol}`;

  const translateY = rise.interpolate({
    inputRange: [0, 1],
    outputRange: [8, -56],
  });

  return (
    <View pointerEvents="none" style={styles.host} accessibilityElementsHidden>
      {sparkleAnims.map((s, i) => {
        const spec = SPARKLES[i];
        const opacity = s.t.interpolate({
          inputRange: [0, 0.15, 0.7, 1],
          outputRange: [0, 1, 0.7, 0],
        });
        const tx = s.t.interpolate({
          inputRange: [0, 1],
          outputRange: [0, spec.dx * 1.4],
        });
        const ty = s.t.interpolate({
          inputRange: [0, 1],
          outputRange: [0, spec.dy * 1.4],
        });
        const sc = s.t.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0.4, 1.1, 0.3],
        });
        return (
          <Animated.Text
            key={i}
            style={[
              styles.sparkle,
              {
                fontSize: spec.size,
                opacity,
                transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
              },
            ]}
          >
            {spec.glyph}
          </Animated.Text>
        );
      })}
      <Animated.View
        style={[
          styles.bubble,
          {
            opacity: fade,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <Text style={styles.bubbleText}>{label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    overflow: "visible",
  },
  bubble: {
    backgroundColor: rewardsUi.pillYellow,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: rewardsUi.pillYellowBorder,
    ...rewardsUi.shadow,
  },
  bubbleText: {
    fontWeight: "900",
    color: rewardsUi.pillYellowText,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  sparkle: {
    position: "absolute",
    color: rewardsUi.pillYellowText,
    fontWeight: "800",
  },
});
