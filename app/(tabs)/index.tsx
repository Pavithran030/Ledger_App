import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { reportsService, DashboardMetrics } from "@/services/reports";
import { MoneyText } from "@/components/MoneyText";
import { formatDate } from "@/utils/dates";
import { Ionicons } from "@expo/vector-icons";
import { useSettingsStore } from "@/store/settingsStore";

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const millName = useSettingsStore((state) => state.millName);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    try {
      const data = reportsService.getDashboardMetrics();
      setMetrics(data);
    } catch (e) {
      console.error("Failed to load dashboard metrics", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-slate-50">
      <ScrollView
        className="flex-1 bg-slate-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Mill Header */}
        <View className="mb-5 flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-2xl font-black text-slate-900" numberOfLines={1}>
              {millName}
            </Text>
            <Text className="text-xs font-semibold text-slate-500">
              {formatDate(new Date())} • {t("home.title")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            accessibilityRole="button"
            accessibilityLabel={t("settings.title")}
            className="h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <Ionicons name="settings-outline" size={24} color="#334155" />
          </TouchableOpacity>
        </View>

        {/* Main Outstanding Credit Card */}
        <View className="mb-4 rounded-3xl border border-red-100 bg-red-50/50 p-5 shadow-sm">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold uppercase tracking-wider text-red-700">
              {t("home.totalPending")}
            </Text>
            <Ionicons name="alert-circle" size={18} color="#dc2626" />
          </View>
          <View className="mt-2">
            <MoneyText paise={metrics?.totalPendingPaise || 0} type="balance" size="3xl" />
          </View>
          <Text className="mt-1 text-xs text-red-600/80">
            {t("home.pendingCreditSummary")}
          </Text>
        </View>

        {/* Today's Sales Row */}
        <View className="mb-4 flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Text className="text-xs font-semibold text-slate-500">{t("home.todayCash")}</Text>
            <View className="mt-1">
              <MoneyText paise={metrics?.todayCashPaise || 0} type="cash" size="xl" />
            </View>
          </View>

          <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Text className="text-xs font-semibold text-slate-500">{t("home.todayCredit")}</Text>
            <View className="mt-1">
              <MoneyText paise={metrics?.todayCreditPaise || 0} type="credit" size="xl" />
            </View>
          </View>
        </View>

        {/* Today's Payments Received */}
        <View className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-semibold text-slate-500">
                {t("home.todayPayments")}
              </Text>
              <View className="mt-1">
                <MoneyText paise={metrics?.todayPaymentsPaise || 0} type="payment" size="xl" />
              </View>
            </View>
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <Ionicons name="wallet-outline" size={20} color="#2563eb" />
            </View>
          </View>
        </View>

        {/* Overdue Accounts Banner */}
        {metrics && metrics.overdueCustomers.length > 0 && (
          <View className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <View className="mb-2 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={18} color="#b91c1c" />
                <Text className="ml-2 font-bold text-red-900">
                  {t("home.overdueCustomers")} ({metrics.overdueCustomers.length})
                </Text>
              </View>
            </View>

            {metrics.overdueCustomers.slice(0, 3).map((oc, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => router.push(`/customer/${oc.customer_id}`)}
                className="mt-2 min-h-[48px] flex-row items-center justify-between rounded-xl bg-white/80 p-3"
              >
                <View>
                  <Text className="text-sm font-bold text-slate-800">{oc.customer_name}</Text>
                  <Text className="text-[11px] text-red-600">
                    Due: {formatDate(oc.due_date)} (Bill #{oc.bill_no})
                  </Text>
                </View>
                <MoneyText paise={oc.current_balance_paise} type="balance" size="sm" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Top Pending Customers */}
        <View className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-bold text-slate-900">{t("home.highestPending")}</Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/customers")}
              accessibilityRole="button"
              className="min-h-[48px] justify-center px-2 py-1"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text className="text-xs font-bold text-emerald-700">{t("home.allCustomers")}</Text>
            </TouchableOpacity>
          </View>

          {metrics && metrics.topPendingCustomers.length > 0 ? (
            <View className="divide-y divide-slate-100">
              {metrics.topPendingCustomers.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => router.push(`/customer/${c.id}`)}
                  className="min-h-[48px] flex-row items-center justify-between py-3"
                >
                  <View>
                    <Text className="text-sm font-bold text-slate-900">{c.name}</Text>
                    <Text className="text-xs text-slate-400">
                      {c.village || c.phone || ""}
                    </Text>
                  </View>
                  <MoneyText paise={c.balance_paise} type="balance" size="md" />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text className="py-4 text-center text-xs text-slate-400">
              {t("home.noPendingSettled")}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
