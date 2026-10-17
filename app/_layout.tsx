import "../global.css";
import "../src/i18n";
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/pin" options={{ headerShown: false }} />
        <Stack.Screen name="customer/[id]" options={{ headerShown: true, title: "Customer Ledger" }} />
        <Stack.Screen name="customer/new" options={{ headerShown: true, title: "Add Customer" }} />
        <Stack.Screen name="product/[id]" options={{ headerShown: true, title: "Product Details" }} />
        <Stack.Screen name="bill/[id]" options={{ headerShown: true, title: "Bill Details" }} />
        <Stack.Screen name="settings" options={{ headerShown: true, title: "Settings" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
