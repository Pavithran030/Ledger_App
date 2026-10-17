import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";

export default function NewCustomerScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-slate-50 p-4">
      <Text className="text-xl font-bold text-slate-900">{t("customers.addCustomer")}</Text>
    </View>
  );
}
