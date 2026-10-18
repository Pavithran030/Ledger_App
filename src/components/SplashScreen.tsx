/**
 * SplashScreen component
 *
 * Shown while the app initialises (DB migrations, settings load, PIN check).
 * Pure React Native – no Reanimated or external animation libraries needed.
 * Uses React Native's built-in Animated API (available in Expo Go, no build step).
 *
 * Design:
 *   Dark forest-green gradient background (#0a2e1a → #14532d)
 *   Animated grain logo + mill name
 *   Three-dot breathing loader that fades in after 400 ms
 *   Tagline fades in at 600 ms
 */
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
  Easing,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const DOT_SIZE = 10;
const DOT_GAP = 14;

// ── Individual breathing dot ─────────────────────────────────────────────────
function Dot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 480,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: 480,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, opacity]);

  return (
    <Animated.View
      style={[
        styles.dot,
        { opacity, marginHorizontal: DOT_GAP / 2 },
      ]}
    />
  );
}

// ── Logo pulse ring ───────────────────────────────────────────────────────────
function PulseRing() {
  const scale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.35,
            duration: 1200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 1200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, ringOpacity]);

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        { transform: [{ scale }], opacity: ringOpacity },
      ]}
    />
  );
}

// ── Main splash component ─────────────────────────────────────────────────────
export function SplashScreen({ shopName }: { shopName?: string }) {
  // Staggered fade-ins
  const logoFade = useRef(new Animated.Value(0)).current;
  const logoSlide = useRef(new Animated.Value(24)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;
  const dotsFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Logo appears first
      Animated.parallel([
        Animated.timing(logoFade, {
          toValue: 1,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoSlide, {
          toValue: 0,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Tagline fades in
      Animated.timing(taglineFade, {
        toValue: 1,
        duration: 400,
        delay: 100,
        useNativeDriver: true,
      }),
      // Dots appear last
      Animated.timing(dotsFade, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoFade, logoSlide, taglineFade, dotsFade]);

  const displayName = shopName && shopName.trim() ? shopName.trim() : "Cattle Feed Ledger";

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Background decorative circles */}
      <View style={[styles.bgCircle, { top: -80, right: -80, width: 280, height: 280, opacity: 0.07 }]} />
      <View style={[styles.bgCircle, { bottom: -60, left: -60, width: 220, height: 220, opacity: 0.05 }]} />
      <View style={[styles.bgCircle, { top: "40%", left: -40, width: 140, height: 140, opacity: 0.04 }]} />

      <View style={styles.center}>
        {/* Logo area */}
        <Animated.View
          style={[
            styles.logoWrapper,
            { opacity: logoFade, transform: [{ translateY: logoSlide }] },
          ]}
        >
          <PulseRing />
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={52} color="#bbf7d0" />
          </View>
        </Animated.View>

        {/* App name */}
        <Animated.View
          style={{ opacity: logoFade, transform: [{ translateY: logoSlide }] }}
        >
          <Text style={styles.millName} numberOfLines={2} adjustsFontSizeToFit>
            {displayName}
          </Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.View style={{ opacity: taglineFade }}>
          <Text style={styles.tagline}>
            Ledger • Credit • Stock
          </Text>
        </Animated.View>

        {/* Separator line */}
        <Animated.View style={[styles.separator, { opacity: taglineFade }]} />

        {/* Breathing dots loader */}
        <Animated.View style={[styles.dotsRow, { opacity: dotsFade }]}>
          <Dot delay={0} />
          <Dot delay={200} />
          <Dot delay={400} />
        </Animated.View>

        <Animated.Text style={[styles.loadingText, { opacity: dotsFade }]}>
          Starting up...
        </Animated.Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Offline-first • Secure • Tamil ready</Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a2e1a",
    alignItems: "center",
    justifyContent: "center",
  },
  bgCircle: {
    position: "absolute",
    borderRadius: 9999,
    backgroundColor: "#16a34a",
  },
  center: {
    alignItems: "center",
    paddingHorizontal: 32,
    width: "100%",
  },
  // Logo
  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    width: 120,
    height: 120,
  },
  pulseRing: {
    position: "absolute",
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#16a34a",
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#14532d",
    borderWidth: 2,
    borderColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  // Text
  millName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#f0fdf4",
    textAlign: "center",
    letterSpacing: 0.3,
    maxWidth: width - 64,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4ade80",
    textAlign: "center",
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  separator: {
    width: 48,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#16a34a",
    marginVertical: 24,
  },
  // Dots
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: "#4ade80",
  },
  loadingText: {
    fontSize: 12,
    color: "#86efac",
    letterSpacing: 0.5,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 40,
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
    color: "#166534",
    letterSpacing: 0.8,
  },
});
