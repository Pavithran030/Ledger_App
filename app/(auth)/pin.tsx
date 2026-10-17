import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";

export default function PinScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-slate-100 p-6">
      <Text className="text-2xl font-bold text-slate-900">{t("settings.securityPin")}</Text>
      <Text className="mt-2 text-slate-500">Enter 4-digit PIN</Text>
    </View>
  );
}
