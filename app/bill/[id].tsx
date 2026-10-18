import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { billsRepo, BillDetail } from "@/db/repositories/billsRepo";
import { BigButton } from "@/components/BigButton";
import { MoneyText } from "@/components/MoneyText";
import { formatDate } from "@/utils/dates";
import { paiseToRupees } from "@/utils/money";
import { whatsappService } from "@/services/whatsapp";
import { pdfService } from "@/services/pdf";
import { Ionicons } from "@expo/vector-icons";

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const [bill, setBill] = useState<BillDetail | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const loadBill = useCallback(() => {
    if (!id) return;
    const b = billsRepo.getById(id);
    setBill(b);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadBill();
    }, [loadBill])
  );

  const handleCancelBill = () => {
    if (!bill || bill.status === "cancelled") return;

    Alert.alert(
      t("dialogs.cancelBillTitle"),
      t("dialogs.cancelBillConfirm", { billNo: bill.bill_no }),
      [
        { text: t("dialogs.cancelBillKeep"), style: "cancel" },
        {
          text: t("dialogs.cancelBillYes"),
          style: "destructive",
          onPress: () => {
            setCancelling(true);
            try {
              billsRepo.cancelBill(bill.id);
              loadBill();
              Alert.alert(t("common.cancelled"), `Bill #${bill.bill_no} cancelled.`);
            } catch (e: any) {
              Alert.alert(t("common.error"), e?.message || "Failed to cancel bill");
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const handleSendWhatsApp = () => {
    if (!bill) return;
    if (!bill.customer_phone) {
      Alert.alert(t("common.warning"), "This bill has no registered customer phone number.");
      return;
    }
    whatsappService.sendBillReceipt(bill);
  };

  const handleSharePdf = async () => {
    if (!bill) return;
    try {
      await pdfService.generateAndShareBillPdf(bill);
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || "Failed to generate PDF statement");
    }
  };

  const handlePrintDirect = async () => {
    if (!bill) return;
    try {
      await pdfService.printBillDirect(bill);
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || "Printing error");
    }
  };

  // Finish the sale: return to the Home screen, clearing the bill screen (and
  // any screens opened before it, e.g. the customer ledger) off the stack.
  const handleDone = () => {
    router.dismissTo("/");
  };

  if (!bill) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Text className="text-slate-500">{t("common.loading")}</Text>
      </View>
    );
  }

  const isCancelled = bill.status === "cancelled";

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4">
      {/* Status Banner */}
      {isCancelled && (
        <View className="mb-4 rounded-2xl bg-red-100 p-4">
          <Text className="text-center text-sm font-bold text-red-800">
            ⚠️ {t("common.cancelled").toUpperCase()} (Stock restored)
          </Text>
        </View>
      )}

      {/* Bill Header Card */}
      <View className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t("bill.billNumber", { number: "" })}
            </Text>
            <Text className="text-2xl font-black text-slate-900">#{bill.bill_no}</Text>
          </View>
          <View
            className={`rounded-xl px-3 py-1.5 ${
              bill.type === "credit" ? "bg-amber-100" : "bg-emerald-100"
            }`}
          >
            <Text
              className={`text-xs font-extrabold uppercase ${
                bill.type === "credit" ? "text-amber-800" : "text-emerald-800"
              }`}
            >
              {bill.customer_id ? t("bill.customerSale") : t("bill.walkInSale")}
            </Text>
          </View>
        </View>

        <View className="mt-4 border-t border-slate-100 pt-3">
          <View className="mb-1 flex-row justify-between items-center">
            <Text className="text-xs text-slate-500">{t("common.date")}</Text>
            <Text className="text-xs font-semibold text-slate-800">
              {formatDate(bill.bill_date)}
            </Text>
          </View>

          <View className="mb-1 flex-row justify-between items-center">
            <Text className="text-xs text-slate-500">{t("bill.customer")}</Text>
            {bill.customer_id ? (
              <TouchableOpacity
                onPress={() => router.push(`/customer/${bill.customer_id}`)}
                className="min-h-[44px] justify-center"
              >
                <Text className="text-xs font-bold text-emerald-700 underline">
                  {bill.customer_name}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text className="text-xs font-bold text-slate-800">
                Walk-in Cash Sale
              </Text>
            )}
          </View>

          {bill.due_date && (
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-slate-500">{t("sale.dueDate")}</Text>
              <Text className="text-xs font-semibold text-amber-700">
                {formatDate(bill.due_date)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Itemized Table */}
      <View className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <Text className="mb-3 text-base font-bold text-slate-900">Purchased Items</Text>

        <View className="divide-y divide-slate-100">
          {bill.items.map((item) => (
            <View key={item.id} className="py-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-bold text-slate-900">
                  {i18n.language === "ta" && item.product_name_ta
                    ? item.product_name_ta
                    : item.product_name}
                </Text>
                <MoneyText paise={item.amount_paise} size="md" />
              </View>
              <View className="mt-1 flex-row items-center justify-between">
                <Text className="text-xs text-slate-500">
                  {item.qty} {item.unit}s @ ₹{paiseToRupees(item.price_paise)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View className="mt-4 flex-row items-center justify-between border-t border-slate-200 pt-4">
          <Text className="text-base font-bold text-slate-600">Grand Total</Text>
          <MoneyText
            paise={bill.total_paise}
            type={bill.type === "credit" ? "credit" : "cash"}
            size="2xl"
          />
        </View>
      </View>

      {/* Actions */}
      <View className="mb-10 gap-3">
        <BigButton
          title={t("dialogs.done")}
          onPress={handleDone}
          variant="primary"
          icon={<Ionicons name="checkmark-circle-outline" size={20} color="white" />}
        />

        {bill.customer_phone && !isCancelled && (
          <BigButton
            title={t("bill.sendWhatsApp")}
            onPress={handleSendWhatsApp}
            variant="whatsapp"
            icon={<Ionicons name="logo-whatsapp" size={20} color="white" />}
          />
        )}

        <View className="flex-row gap-2">
          <View className="flex-1">
            <BigButton
              title={t("bill.sharePdf")}
              onPress={handleSharePdf}
              variant="secondary"
              icon={<Ionicons name="document-text-outline" size={20} color="#1e293b" />}
            />
          </View>
          <View className="flex-1">
            <BigButton
              title={t("bill.printBill")}
              onPress={handlePrintDirect}
              variant="outline"
              icon={<Ionicons name="print-outline" size={20} color="#334155" />}
            />
          </View>
        </View>

        {!isCancelled && (
          <BigButton
            title={t("dialogs.cancelBillTitle")}
            onPress={handleCancelBill}
            variant="danger"
            loading={cancelling}
          />
        )}
      </View>
    </ScrollView>
  );
}
