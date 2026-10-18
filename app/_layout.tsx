import "../global.css";
import "../src/i18n";
import React, { useEffect, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { getDb } from "@/db/client";
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
import { useSyncStore } from "@/store/syncStore";
import { syncService } from "@/services/sync";
import { PinPad } from "@/components/PinPad";
import { SplashScreen } from "@/components/SplashScreen";

// Minimum time (ms) to show the splash so it doesn't just flicker
const SPLASH_MIN_MS = 1400;

export default function RootLayout() {
  const { t } = useTranslation();
  const isLocked = useAuthStore((state) => state.isLocked);
  const isPinSet = useAuthStore((state) => state.isPinSet);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const millName = useSettingsStore((state) => state.millName);

  // Track whether the minimum splash duration has elapsed
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    // 1. Initialize SQLite database & apply migrations
    try {
      getDb();
    } catch (e) {
      console.error("Database initialization error:", e);
    }

    // 2. Load settings and language
    useSettingsStore.getState().loadSettings();

    // 3. Check security PIN lock status
    useAuthStore.getState().checkAuthStatus();

    // 4. Enforce minimum splash visibility so animations play fully
    const timer = setTimeout(() => setSplashDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  // 5. Background cloud sync — never blocks the UI
  useEffect(() => {
    if (!syncService.isConfigured()) return;

    const runSync = () => {
      void useSyncStore.getState().triggerSync();
    };

    runSync();
    const interval = setInterval(runSync, 60000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") runSync();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  // Show branded splash while initialising OR during minimum display window
  const showingSplash = isInitializing || !splashDone;

  return (
    <SafeAreaProvider>
      <StatusBar style={showingSplash ? "light" : "dark"} />

      {showingSplash ? (
        // ── Branded splash / loading screen ──────────────────────────────────
        <SplashScreen shopName={millName} />
      ) : (
        // ── Main app navigator ────────────────────────────────────────────────
        <>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)/pin" options={{ headerShown: false }} />
            <Stack.Screen
              name="customer/[id]"
              options={{ headerShown: true, title: t("navigation.customerLedger") }}
            />
            <Stack.Screen
              name="customer/new"
              options={{ headerShown: true, title: t("navigation.addCustomer") }}
            />
            <Stack.Screen
              name="product/[id]"
              options={{ headerShown: true, title: t("navigation.productDetails") }}
            />
            <Stack.Screen
              name="bill/[id]"
              options={{ headerShown: true, title: t("navigation.billDetails") }}
            />
            <Stack.Screen
              name="settings"
              options={{ headerShown: true, title: t("navigation.settings") }}
            />
            <Stack.Screen
              name="contacts-import"
              options={{ headerShown: true, title: t("navigation.importContacts") }}
            />
          </Stack>

          {/* Full-screen PIN lock gate */}
          {isPinSet && isLocked ? (
            <View style={styles.lockOverlay}>
              <PinPad lockMode />
            </View>
          ) : null}
        </>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  lockOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: "#0f172a",
  },
});
