import React from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { PinPad } from "@/components/PinPad";

/**
 * Route wrapper for the PIN screen. All navigation lives here so that
 * PinPad itself stays free of navigation hooks and can also be rendered
 * as the root lock overlay (which has no navigation context).
 */
export default function PinRoute() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  const isChangeMode = mode === "change";

  return (
    <PinPad
      mode={isChangeMode ? "change" : undefined}
      onSuccess={() => {
        if (isChangeMode) {
          router.back();
        } else {
          router.replace("/(tabs)");
        }
      }}
      onCancel={() => router.back()}
    />
  );
}
