import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";

export default function SettingsScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <Text className="text-xl font-bold text-slate-900">{t("settings.title")}</Text>
      <View className="mt-4 gap-3">
        <View className="rounded-xl border border-slate-200 bg-white p-4">
          <Text className="text-sm font-semibold text-slate-700">{t("settings.shopName")}</Text>
        </View>
        <View className="rounded-xl border border-slate-200 bg-white p-4">
          <Text className="text-sm font-semibold text-slate-700">{t("settings.language")}</Text>
        </View>
      </View>
    </ScrollView>
  );
}
