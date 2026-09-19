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
  /** Total duration in ms (default ~1200). */
  durationMs?: number;
};

/** Symbol for the prominent floating amount. */
export function rewardUnitSymbol(unitKind: RewardUnitKind): "⭐" | "€" {
  return unitKind === "money" ? "€" : "⭐";
}

type ParticleSpec = {
  dx: number;
  dy: number;
  size: number;
  delay: number;
};

// Deliberately generous: the celebration should read as a full-page reward,
// not as a tiny burst attached to the checkbox.
const PARTICLES: ParticleSpec[] = [
  { dx: -156, dy: -92, size: 26, delay: 0 },
  { dx: -118, dy: -156, size: 20, delay: 35 },
  { dx: -66, dy: -202, size: 28, delay: 60 },
  { dx: -4, dy: -174, size: 22, delay: 25 },
  { dx: 58, dy: -218, size: 30, delay: 80 },
  { dx: 116, dy: -158, size: 22, delay: 45 },
  { dx: 164, dy: -90, size: 27, delay: 20 },
  { dx: 190, dy: -18, size: 20, delay: 70 },
  { dx: 164, dy: 62, size: 28, delay: 35 },
  { dx: 120, dy: 132, size: 22, delay: 90 },
  { dx: 62, dy: 178, size: 28, delay: 30 },
  { dx: 0, dy: 156, size: 20, delay: 75 },
  { dx: -64, dy: 184, size: 28, delay: 50 },
  { dx: -126, dy: 132, size: 22, delay: 100 },
  { dx: -176, dy: 64, size: 27, delay: 40 },
  { dx: -196, dy: -12, size: 20, delay: 85 },
  { dx: -104, dy: -42, size: 18, delay: 15 },
  { dx: -42, dy: -80, size: 20, delay: 55 },
  { dx: 46, dy: -66, size: 18, delay: 95 },
  { dx: 104, dy: 12, size: 20, delay: 65 },
];

/**
 * Full-screen, lightweight reward burst for rewarded task completes.
 * Uses RN Animated only (no Reanimated). The parent should fire it only after
 * a successful markTaskDone and render it as a sibling of the screen content.
 */
export function RewardCelebration({
  amount,
  unitKind,
  onFinished,
  durationMs = 1200,
}: RewardCelebrationProps) {
  const rise = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.72)).current;
  const particleAnims = useMemo(
    () => PARTICLES.map(() => ({ t: new Animated.Value(0) })),
    []
  );

  useEffect(() => {
    if (amount <= 0) {
      onFinished?.();
      return;
    }

    rise.setValue(0);
    fade.setValue(0);
    scale.setValue(0.72);
    particleAnims.forEach((particle) => particle.t.setValue(0));

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
          duration: Math.min(180, durationMs * 0.16),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 0,
          duration: durationMs * 0.58,
          delay: durationMs * 0.2,
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
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
    ]);

    const particles = Animated.stagger(
      16,
      particleAnims.map((particle, index) =>
        Animated.timing(particle.t, {
          toValue: 1,
          duration: durationMs * 0.72,
          delay: PARTICLES[index].delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      )
    );

    const run = Animated.parallel([bubble, particles]);
    run.start(({ finished }) => {
      if (finished) onFinished?.();
    });

    return () => {
      run.stop();
    };
  }, [amount, durationMs, fade, onFinished, particleAnims, rise, scale]);

  if (amount <= 0) return null;

  const symbol = rewardUnitSymbol(unitKind);
  const particleGlyph = unitKind === "money" ? "🪙" : "⭐";
  const label = `+${amount} ${symbol}`;
  const translateY = rise.interpolate({
    inputRange: [0, 1],
    outputRange: [12, -14],
  });

  return (
    <View pointerEvents="none" style={styles.host} accessibilityElementsHidden>
      {particleAnims.map((particle, index) => {
        const spec = PARTICLES[index];
        const opacity = particle.t.interpolate({
          inputRange: [0, 0.12, 0.62, 1],
          outputRange: [0, 1, 0.82, 0],
        });
        const tx = particle.t.interpolate({
          inputRange: [0, 1],
          outputRange: [0, spec.dx],
        });
        const ty = particle.t.interpolate({
          inputRange: [0, 1],
          outputRange: [0, spec.dy],
        });
        const particleScale = particle.t.interpolate({
          inputRange: [0, 0.34, 0.72, 1],
          outputRange: [0.35, 1.15, 0.94, 0.25],
        });
        return (
          <Animated.Text
            key={index}
            style={[
              styles.particle,
              {
                fontSize: spec.size,
                marginLeft: -spec.size / 2,
                marginTop: -spec.size / 2,
                opacity,
                transform: [
                  { translateX: tx },
                  { translateY: ty },
                  { scale: particleScale },
                ],
              },
            ]}
          >
            {particleGlyph}
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
    zIndex: 100,
    elevation: 100,
    overflow: "visible",
  },
  particle: {
    position: "absolute",
    left: "50%",
    top: "50%",
    color: rewardsUi.pillYellowText,
    fontWeight: "800",
    textAlign: "center",
  },
  bubble: {
    backgroundColor: rewardsUi.pillYellow,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderWidth: 2,
    borderColor: rewardsUi.pillYellowBorder,
    ...rewardsUi.shadow,
  },
  bubbleText: {
    fontWeight: "900",
    color: rewardsUi.pillYellowText,
    fontSize: 28,
    letterSpacing: 0.3,
  },
});
