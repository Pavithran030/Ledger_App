import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { Link } from "expo-router";

export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      <View className="mb-6 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-slate-900">{t("home.title")}</Text>
          <Text className="text-slate-500">{t("common.appName")}</Text>
        </View>
        <Link href="/settings" className="rounded-full bg-slate-200 p-3">
          <Text className="text-sm font-semibold text-slate-700">⚙️</Text>
        </Link>
      </View>

      <View className="gap-3">
        <View className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <Text className="text-sm font-medium text-slate-500">{t("home.totalPending")}</Text>
          <Text className="mt-1 text-3xl font-extrabold text-red-600">₹0.00</Text>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Text className="text-xs font-medium text-slate-500">{t("home.todayCash")}</Text>
            <Text className="mt-1 text-xl font-bold text-emerald-600">₹0.00</Text>
          </View>
          <View className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Text className="text-xs font-medium text-slate-500">{t("home.todayCredit")}</Text>
            <Text className="mt-1 text-xl font-bold text-amber-600">₹0.00</Text>
          </View>
        </View>

        <View className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <Text className="text-xs font-medium text-slate-500">{t("home.todayPayments")}</Text>
          <Text className="mt-1 text-xl font-bold text-blue-600">₹0.00</Text>
        </View>
      </View>
    </ScrollView>
  );
}
