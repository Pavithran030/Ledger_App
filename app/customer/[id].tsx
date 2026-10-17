import React from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-slate-50 p-4">
      <Text className="text-xl font-bold text-slate-900">{t("customers.ledger")}</Text>
      <Text className="text-slate-500">Customer ID: {id}</Text>
    </View>
  );
}
