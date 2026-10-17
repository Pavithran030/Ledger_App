import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";

export default function SaleScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-slate-50 p-6">
      <Text className="text-xl font-bold text-slate-800">{t("sale.title")}</Text>
      <Text className="mt-2 text-center text-slate-500">
        {t("sale.cashSale")} / {t("sale.creditSale")}
      </Text>
    </View>
  );
}
