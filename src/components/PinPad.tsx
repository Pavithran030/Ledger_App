import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/store/authStore";

export interface PinPadProps {
  /** "change" asks for the current PIN first, then sets a new one. */
  mode?: "change";
  /** Rendered as a locked overlay: no back/cancel bar, no navigation. */
  lockMode?: boolean;
  /** Called when the PIN flow finishes successfully. */
  onSuccess?: () => void;
  /** Called when the user dismisses the pad. */
  onCancel?: () => void;
}

export function PinPad({ mode, lockMode = false, onSuccess, onCancel }: PinPadProps) {
  const { t } = useTranslation();

  const isPinSet = useAuthStore((state) => state.isPinSet);
  const hasBiometrics = useAuthStore((state) => state.hasBiometrics);
  const verifyPin = useAuthStore((state) => state.verifyPin);
  const unlockWithBiometrics = useAuthStore((state) => state.unlockWithBiometrics);
  const setPinStore = useAuthStore((state) => state.setPin);
  const lockoutUntil = useAuthStore((state) => state.lockoutUntil);

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState<"enter" | "setup_first" | "setup_confirm">(
    isPinSet ? "enter" : "setup_first"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  useEffect(() => {
    setStep(isPinSet ? "enter" : "setup_first");
  }, [isPinSet]);

  const handleBiometrics = useCallback(async () => {
    const success = await unlockWithBiometrics();
    if (success) {
      onSuccess?.();
    }
  }, [unlockWithBiometrics, onSuccess]);

  // Offer biometrics once when unlocking with an existing PIN.
  const biometricsPrompted = useRef(false);
  useEffect(() => {
    if (!isPinSet || !hasBiometrics || biometricsPrompted.current) return;
    biometricsPrompted.current = true;
    void handleBiometrics();
  }, [isPinSet, hasBiometrics, handleBiometrics]);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) {
      setLockoutCountdown(0);
      return;
    }
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutCountdown(remaining);
      if (remaining === 0) {
        setErrorMessage("");
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const handleKeyPress = async (digit: string) => {
    if (lockoutCountdown > 0) return;
    setErrorMessage("");
    const nextPin = pin + digit;
    if (nextPin.length > 4) return;

    setPin(nextPin);

    if (nextPin.length !== 4) return;

    if (step === "enter") {
      const result = await verifyPin(nextPin);
      if (result.success) {
        if (mode === "change") {
          setPin("");
          setStep("setup_first");
        } else {
          onSuccess?.();
        }
      } else {
        setPin("");
        if (result.lockedOut) {
          setErrorMessage(t("auth.lockedOut", { seconds: result.remainingSeconds || 30 }));
        } else {
          setErrorMessage(t("auth.incorrectPin"));
        }
      }
      return;
    }

    if (step === "setup_first") {
      setConfirmPin(nextPin);
      setPin("");
      setStep("setup_confirm");
      return;
    }

    if (nextPin === confirmPin) {
      await setPinStore(nextPin);
      Alert.alert(t("common.success"), t("auth.pinSuccess"));
      onSuccess?.();
    } else {
      setErrorMessage(t("auth.pinMismatch"));
      setPin("");
      setConfirmPin("");
      setStep("setup_first");
    }
  };

  const handleBackspace = () => {
    if (lockoutCountdown > 0) return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage("");
  };

  const getTitle = () => {
    if (step === "setup_first") return t("auth.createPin");
    if (step === "setup_confirm") return t("auth.confirmPin");
    if (mode === "change") return t("auth.verifyOldPin");
    return t("auth.enterPin");
  };

  const getSubtitle = () => {
    if (step === "setup_first") return t("auth.createPinSubtitle");
    if (step === "setup_confirm") return t("auth.confirmPinSubtitle");
    if (mode === "change") return t("auth.verifyOldPinSubtitle");
    return t("auth.enterPinSubtitle");
  };

  return (
    <SafeAreaView className="flex-1 justify-between bg-slate-900 p-6">
      {/* Top bar with Cancel/Back if accessed from Settings */}
      <View className="min-h-[48px] w-full flex-row items-center justify-between">
        {!lockMode ? (
          <TouchableOpacity
            onPress={onCancel}
            className="min-h-[48px] min-w-[48px] flex-row items-center p-2"
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
          >
            <Ionicons name="arrow-back" size={24} color="#94a3b8" />
            <Text className="ml-1 text-base font-semibold text-slate-300">
              {t("common.cancel")}
            </Text>
          </TouchableOpacity>
        ) : (
          <View className="h-6" />
        )}
      </View>

      {/* Header & Status */}
      <View className="items-center">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-emerald-600/20">
          <Ionicons name="lock-closed" size={32} color="#10b981" />
        </View>
        <Text className="text-2xl font-black text-white">{getTitle()}</Text>
        <Text className="mt-2 text-center text-sm text-slate-400">{getSubtitle()}</Text>

        {/* PIN Indicators */}
        <View className="my-8 flex-row gap-4">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <View
                key={index}
                className={`h-4 w-4 rounded-full border-2 ${
                  isFilled ? "border-emerald-500 bg-emerald-500" : "border-slate-600 bg-transparent"
                }`}
              />
            );
          })}
        </View>

        {errorMessage ? (
          <Text className="px-4 text-center font-bold text-red-400">{errorMessage}</Text>
        ) : null}

        {lockoutCountdown > 0 && (
          <Text className="mt-2 font-bold text-amber-400">
            {t("auth.lockedOut", { seconds: lockoutCountdown })}
          </Text>
        )}
      </View>

      {/* Number Pad (Min 48dp touch targets) */}
      <View className="mb-6 w-full max-w-xs self-center gap-4">
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
        ].map((row, rowIdx) => (
          <View key={rowIdx} className="flex-row justify-between">
            {row.map((digit) => (
              <TouchableOpacity
                key={digit}
                onPress={() => handleKeyPress(digit)}
                disabled={lockoutCountdown > 0}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={digit}
                className="h-16 w-16 min-h-[56px] min-w-[56px] items-center justify-center rounded-full bg-slate-800"
              >
                <Text className="text-2xl font-black text-white">{digit}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <View className="flex-row justify-between">
          {/* Biometrics button */}
          <TouchableOpacity
            onPress={handleBiometrics}
            disabled={step !== "enter" || !hasBiometrics || lockoutCountdown > 0}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t("auth.useBiometrics")}
            className={`h-16 w-16 min-h-[56px] min-w-[56px] items-center justify-center rounded-full bg-slate-800/50 ${
              step !== "enter" || !hasBiometrics ? "opacity-30" : ""
            }`}
          >
            <Ionicons name="finger-print" size={28} color="#10b981" />
          </TouchableOpacity>

          {/* Zero */}
          <TouchableOpacity
            onPress={() => handleKeyPress("0")}
            disabled={lockoutCountdown > 0}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="0"
            className="h-16 w-16 min-h-[56px] min-w-[56px] items-center justify-center rounded-full bg-slate-800"
          >
            <Text className="text-2xl font-black text-white">0</Text>
          </TouchableOpacity>

          {/* Backspace */}
          <TouchableOpacity
            onPress={handleBackspace}
            disabled={lockoutCountdown > 0}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Backspace"
            className="h-16 w-16 min-h-[56px] min-w-[56px] items-center justify-center rounded-full bg-slate-800/50"
          >
            <Ionicons name="backspace-outline" size={26} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
