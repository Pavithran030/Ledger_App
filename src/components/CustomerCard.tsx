import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { CustomerWithBalance } from "@/services/balance";
import { MoneyText } from "./MoneyText";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

export interface CustomerCardProps {
  customer: CustomerWithBalance;
}

export function CustomerCard({ customer }: CustomerCardProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const handlePress = () => {
    router.push(`/customer/${customer.id}`);
  };

  const statusLabel =
    customer.balance_paise > 0
      ? t("customers.pendingBalance")
      : customer.balance_paise < 0
      ? t("customers.advance")
      : t("common.status");

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${customer.name}, ${customer.village || ""}, ${statusLabel}`}
      className="min-h-[72px] mb-3 flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <View className="flex-1 pr-3">
        <Text className="text-lg font-bold text-slate-900" numberOfLines={1} ellipsizeMode="tail">
          {customer.name}
        </Text>
        <View className="mt-1 flex-row items-center flex-wrap gap-2">
          {customer.village ? (
            <View className="flex-row items-center max-w-[140px]">
              <Ionicons name="location-outline" size={14} color="#64748b" />
              <Text className="ml-1 text-xs font-medium text-slate-500" numberOfLines={1} ellipsizeMode="tail">
                {customer.village}
              </Text>
            </View>
          ) : null}
          {customer.phone ? (
            <View className="flex-row items-center">
              <Ionicons name="call-outline" size={14} color="#64748b" />
              <Text className="ml-1 text-xs font-medium text-slate-500">{customer.phone}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="items-end shrink-0 pl-2">
        <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {statusLabel}
        </Text>
        <MoneyText paise={customer.balance_paise} type="balance" size="lg" />
      </View>
    </TouchableOpacity>
  );
}
