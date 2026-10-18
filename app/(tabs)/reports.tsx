import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "expo-router";
import { reportsService, PeriodSummary } from "@/services/reports";
import { MoneyText } from "@/components/MoneyText";
import { BigButton } from "@/components/BigButton";
import { getTodayDateString } from "@/utils/dates";
import { subDays, startOfMonth, format } from "date-fns";
import { Ionicons } from "@expo/vector-icons";

type TimeFilter = "today" | "week" | "month";

export default function ReportsScreen() {
  const { t, i18n } = useTranslation();

  const [filter, setFilter] = useState<TimeFilter>("today");
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const getDatesForFilter = (f: TimeFilter): { start: string; end: string } => {
    const today = new Date();
    const endStr = getTodayDateString();

    if (f === "today") {
      return { start: endStr, end: endStr };
    } else if (f === "week") {
      const startStr = format(subDays(today, 6), "yyyy-MM-dd");
      return { start: startStr, end: endStr };
    } else {
      const startStr = format(startOfMonth(today), "yyyy-MM-dd");
      return { start: startStr, end: endStr };
    }
  };

  const loadSummary = useCallback(() => {
    try {
      const { start, end } = getDatesForFilter(filter);
      const data = reportsService.getPeriodSummary(start, end);
      setSummary(data);
    } catch (e) {
      console.error("Failed to load period summary", e);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    loadSummary();
    setRefreshing(false);
  };

  const handleExportCsv = async (type: "customers" | "bills" | "payments") => {
    setExporting(type);
    try {
      await reportsService.exportToCSV(type);
    } catch {
      Alert.alert(t("common.error"), t("reports.exportError"));
    } finally {
      setExporting(null);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Time Filter Segment (>=48dp touch target) */}
      <View className="mb-5 flex-row rounded-2xl bg-slate-200 p-1.5">
        <TouchableOpacity
          onPress={() => setFilter("today")}
          accessibilityRole="button"
          accessibilityLabel={t("reports.today")}
          className={`min-h-[48px] flex-1 items-center justify-center rounded-xl ${
            filter === "today" ? "bg-white" : ""
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              filter === "today" ? "text-slate-900" : "text-slate-600"
            }`}
          >
            {t("reports.today")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter("week")}
          accessibilityRole="button"
          accessibilityLabel={t("reports.last7Days")}
          className={`min-h-[48px] flex-1 items-center justify-center rounded-xl ${
            filter === "week" ? "bg-white" : ""
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              filter === "week" ? "text-slate-900" : "text-slate-600"
            }`}
          >
            {t("reports.last7Days")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter("month")}
          accessibilityRole="button"
          accessibilityLabel={t("reports.thisMonth")}
          className={`min-h-[48px] flex-1 items-center justify-center rounded-xl ${
            filter === "month" ? "bg-white" : ""
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              filter === "month" ? "text-slate-900" : "text-slate-600"
            }`}
          >
            {t("reports.thisMonth")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Metrics Summary Cards */}
      <View className="mb-5 gap-3">
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Text className="text-xs font-semibold text-slate-500">{t("sale.cashSale")}</Text>
            <View className="mt-1">
              <MoneyText paise={summary?.cashSalesPaise || 0} type="cash" size="xl" />
            </View>
          </View>

          <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Text className="text-xs font-semibold text-slate-500">{t("sale.creditSale")}</Text>
            <View className="mt-1">
              <MoneyText paise={summary?.creditSalesPaise || 0} type="credit" size="xl" />
            </View>
          </View>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Text className="text-xs font-semibold text-slate-500">
              {t("reports.paymentsCollected")}
            </Text>
            <View className="mt-1">
              <MoneyText paise={summary?.paymentsReceivedPaise || 0} type="payment" size="xl" />
            </View>
          </View>

          <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Text className="text-xs font-semibold text-slate-500">
              {t("reports.grossSales")}
            </Text>
            <View className="mt-1">
              <MoneyText paise={summary?.totalSalesPaise || 0} type="neutral" size="xl" />
            </View>
          </View>
        </View>
      </View>

      {/* Product-Wise Sales Breakdown */}
      <View className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-base font-bold text-slate-900">{t("reports.productWiseSales")}</Text>
          <Text className="text-xs text-slate-400">
            {summary?.productSales.length || 0} {t("reports.sold")}
          </Text>
        </View>

        {summary && summary.productSales.length > 0 ? (
          <View className="divide-y divide-slate-100">
            {summary.productSales.map((ps) => (
              <View key={ps.product_id} className="flex-row items-center justify-between py-3">
                <View>
                  <Text className="text-sm font-bold text-slate-900">{ps.product_name}</Text>
                  <Text className="text-xs text-slate-400">
                    {ps.total_qty} {ps.unit}s
                  </Text>
                </View>
                <MoneyText paise={ps.total_amount_paise} size="md" />
              </View>
            ))}
          </View>
        ) : (
          <Text className="py-4 text-center text-xs text-slate-400">
            {t("reports.noSalesInPeriod")}
          </Text>
        )}
      </View>

      {/* CSV Data Export Section */}
      <View className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <View className="mb-2 flex-row items-center">
          <Ionicons name="cloud-download-outline" size={20} color="#059669" />
          <Text className="ml-2 text-base font-bold text-slate-900">
            {t("reports.exportCsv")}
          </Text>
        </View>

        <View className="gap-2.5 mt-3">
          <BigButton
            title={t("reports.exportCustomers")}
            onPress={() => handleExportCsv("customers")}
            variant="outline"
            loading={exporting === "customers"}
            size="md"
          />
          <BigButton
            title={t("reports.exportBills")}
            onPress={() => handleExportCsv("bills")}
            variant="outline"
            loading={exporting === "bills"}
            size="md"
          />
          <BigButton
            title={t("reports.exportPayments")}
            onPress={() => handleExportCsv("payments")}
            variant="outline"
            loading={exporting === "payments"}
            size="md"
          />
        </View>
      </View>
    </ScrollView>
  );
}
