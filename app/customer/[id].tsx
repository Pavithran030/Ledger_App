import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { customersRepo, Customer } from "@/db/repositories/customersRepo";
import { paymentsRepo, PaymentMode } from "@/db/repositories/paymentsRepo";
import { balanceService, LedgerItem } from "@/services/balance";
import { whatsappService } from "@/services/whatsapp";
import { pdfService } from "@/services/pdf";
import { MoneyText } from "@/components/MoneyText";
import { BigButton } from "@/components/BigButton";
import { AmountInput } from "@/components/AmountInput";
import { EmptyState } from "@/components/EmptyState";
import { rupeesToPaise, paiseToRupees } from "@/utils/money";
import { formatDate, getTodayDateString } from "@/utils/dates";
import { Ionicons } from "@expo/vector-icons";

const PAYMENT_MODES: PaymentMode[] = ["cash", "upi", "bank", "other"];

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [balancePaise, setBalancePaise] = useState(0);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment Modal State
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [payAmountRupees, setPayAmountRupees] = useState("");
  const [payMode, setPayMode] = useState<PaymentMode>("cash");
  const [payNote, setPayNote] = useState("");
  const [payDate, setPayDate] = useState(getTodayDateString());
  const [savingPayment, setSavingPayment] = useState(false);

  const loadCustomerData = useCallback(() => {
    if (!id) return;
    try {
      const cust = customersRepo.getById(id);
      if (!cust) {
        Alert.alert(t("common.error"), "Customer not found");
        router.back();
        return;
      }
      setCustomer(cust);

      const bal = balanceService.getCustomerBalance(id);
      setBalancePaise(bal);

      const items = balanceService.getLedger(id);
      setLedger(items);
    } catch (e) {
      console.error("Failed to load customer", e);
    } finally {
      setLoading(false);
    }
  }, [id, router, t]);

  useFocusEffect(
    useCallback(() => {
      loadCustomerData();
    }, [loadCustomerData])
  );

  const enteredPayPaise = rupeesToPaise(payAmountRupees);
  const previewBalancePaise = balancePaise - enteredPayPaise;

  const handleSavePayment = () => {
    if (!customer) return;
    if (enteredPayPaise <= 0) {
      Alert.alert(t("sale.validation"), t("sale.validPriceError"));
      return;
    }

    // Validate payment date
    const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(payDate.trim())
      ? payDate.trim()
      : getTodayDateString();

    setSavingPayment(true);
    try {
      paymentsRepo.addPayment({
        customer_id: customer.id,
        amount_paise: enteredPayPaise,
        mode: payMode,
        pay_date: cleanDate,
        note: payNote.trim() || null,
      });

      setPayAmountRupees("");
      setPayNote("");
      setPayModalVisible(false);
      loadCustomerData();

      // Offer WhatsApp payment receipt if customer has phone
      if (customer.phone) {
        Alert.alert(
          t("dialogs.paymentRecorded"),
          t("dialogs.sendWhatsappPrompt"),
          [
            { text: t("common.no"), style: "cancel" },
            {
              text: t("dialogs.sendReceipt"),
              onPress: () => {
                whatsappService.sendPaymentReceipt({
                  customerName: customer.name,
                  phone: customer.phone!,
                  paidAmountPaise: enteredPayPaise,
                  remainingBalancePaise: previewBalancePaise,
                  payDate: cleanDate,
                  mode: payMode,
                  language: (i18n.language as "en" | "ta") || "en",
                });
              },
            },
          ]
        );
      }
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || "Failed to record payment");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleCancelPayment = (item: LedgerItem) => {
    Alert.alert(
      t("dialogs.cancelPaymentTitle"),
      t("dialogs.cancelPaymentConfirm"),
      [
        { text: t("dialogs.cancelPaymentKeep"), style: "cancel" },
        {
          text: t("dialogs.cancelPaymentYes"),
          style: "destructive",
          onPress: () => {
            paymentsRepo.cancelPayment(item.id);
            loadCustomerData();
          },
        },
      ]
    );
  };

  const handleSendWhatsAppBalance = () => {
    if (!customer) return;
    if (!customer.phone) {
      Alert.alert(t("common.warning"), "This customer does not have a registered mobile number.");
      return;
    }

    const recentBills = ledger
      .filter((l) => l.kind === "bill" && l.status === "active")
      .slice(-3)
      .map((b) => ({ date: b.date, bill_no: b.ref_no || 0, amount_paise: b.amount_paise }));

    const recentPayments = ledger
      .filter((l) => l.kind === "payment" && l.status === "active")
      .slice(-3)
      .map((p) => ({ date: p.date, amount_paise: p.amount_paise, mode: p.mode || "cash" }));

    whatsappService.sendBalance({
      customerName: customer.name,
      phone: customer.phone,
      balancePaise,
      recentBills,
      recentPayments,
      language: (i18n.language as "en" | "ta") || "en",
    });
  };

  const handleShareStatementPdf = async () => {
    if (!customer) return;
    try {
      await pdfService.generateAndShareCustomerStatement(customer, ledger, balancePaise);
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || "Failed to export PDF statement");
    }
  };

  if (loading || !customer) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {/* Customer Profile & Balance Hero Card */}
        <View className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-2xl font-black text-slate-900">{customer.name}</Text>
              <View className="mt-1 flex-row items-center gap-3">
                {customer.phone && (
                  <View className="flex-row items-center">
                    <Ionicons name="call-outline" size={14} color="#64748b" />
                    <Text className="ml-1 text-xs font-semibold text-slate-600">
                      {customer.phone}
                    </Text>
                  </View>
                )}
                {customer.village && (
                  <View className="flex-row items-center">
                    <Ionicons name="location-outline" size={14} color="#64748b" />
                    <Text className="ml-1 text-xs font-semibold text-slate-600">
                      {customer.village}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {customer.credit_limit_paise > 0 && (
              <View className="rounded-xl bg-slate-100 px-3 py-1.5 items-end shrink-0">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t("customers.creditLimit")}
                </Text>
                <Text className="text-xs font-black text-slate-700">
                  ₹{paiseToRupees(customer.credit_limit_paise)}
                </Text>
              </View>
            )}
          </View>

          {/* Current Dynamic Balance Box */}
          <View className="mt-5 rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {balancePaise > 0
                ? t("customers.pendingBalance")
                : balancePaise < 0
                ? t("customers.advance")
                : t("common.status")}
            </Text>
            <View className="mt-1 flex-row items-baseline">
              <MoneyText paise={balancePaise} type="balance" size="3xl" />
            </View>
          </View>

          {/* Primary Quick Actions */}
          <View className="mt-4 flex-row gap-3">
            <View className="flex-1">
              <BigButton
                title={`+ ${t("customers.addPayment")}`}
                onPress={() => setPayModalVisible(true)}
                variant="primary"
                size="md"
              />
            </View>
            <View className="flex-1">
              <BigButton
                title={t("customers.newBill")}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/sale",
                    params: {
                      customerId: customer.id,
                      customerName: customer.name,
                    },
                  })
                }
                variant="secondary"
                size="md"
              />
            </View>
          </View>

          {/* WhatsApp & PDF Sharing Actions */}
          <View className="mt-3 flex-row gap-2">
            {customer.phone && (
              <TouchableOpacity
                onPress={handleSendWhatsAppBalance}
                accessibilityRole="button"
                accessibilityLabel="Send WhatsApp Balance"
                className="min-h-[48px] flex-1 flex-row items-center justify-center rounded-xl bg-emerald-50 px-3 border border-emerald-200"
              >
                <Ionicons name="logo-whatsapp" size={18} color="#059669" />
                <Text className="ml-1.5 text-xs font-bold text-emerald-800">
                  WhatsApp
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleShareStatementPdf}
              accessibilityRole="button"
              accessibilityLabel="Share PDF Statement"
              className="min-h-[48px] flex-1 flex-row items-center justify-center rounded-xl bg-slate-100 px-3 border border-slate-200"
            >
              <Ionicons name="document-text-outline" size={18} color="#334155" />
              <Text className="ml-1.5 text-xs font-bold text-slate-800">
                PDF Statement
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Ledger History List */}
        <View className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-slate-900">{t("customers.ledger")}</Text>
            <Text className="text-xs text-slate-400">{ledger.length} entries</Text>
          </View>

          {ledger.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="No transactions yet"
              message="New sales and payments will appear in this ledger"
            />
          ) : (
            <View className="divide-y divide-slate-100">
              {ledger.map((item) => {
                const isCancelled = item.status === "cancelled";

                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={item.kind === "bill" && !isCancelled ? 0.6 : 1}
                    disabled={item.kind !== "bill" || isCancelled}
                    onPress={() => router.push(`/bill/${item.id}`)}
                    className={`py-3.5 ${isCancelled ? "opacity-40" : ""}`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center gap-2">
                          <Text
                            className={`text-base font-bold ${
                              isCancelled
                                ? "line-through text-slate-400"
                                : item.kind === "bill"
                                ? "text-amber-800"
                                : "text-emerald-800"
                            }`}
                          >
                            {item.kind === "bill"
                              ? `Bill #${item.ref_no || ""}`
                              : `Payment (${item.mode?.toUpperCase()})`}
                          </Text>
                          {isCancelled && (
                            <View className="rounded bg-red-100 px-1.5 py-0.5">
                              <Text className="text-[10px] font-bold text-red-700">
                                {t("common.cancelled")}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-xs text-slate-400">
                          {formatDate(item.date)} {item.note ? `• ${item.note}` : ""}
                        </Text>
                      </View>

                      {/* Entry Amount */}
                      <View className="items-end">
                        <View className="flex-row items-center">
                          <Text
                            className={`text-base font-extrabold mr-1 ${
                              item.kind === "bill" ? "text-amber-700" : "text-blue-700"
                            }`}
                          >
                            {item.kind === "bill" ? "+" : "-"}
                          </Text>
                          <MoneyText
                            paise={item.amount_paise}
                            type={item.kind === "bill" ? "credit" : "payment"}
                            size="md"
                          />
                        </View>
                        <Text className="text-[11px] text-slate-400">
                          Balance: ₹{paiseToRupees(item.running_balance_paise)}
                        </Text>
                      </View>

                      {item.kind === "bill" && !isCancelled && (
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="#cbd5e1"
                          style={{ marginLeft: 4 }}
                        />
                      )}

                      {/* Actions */}
                      {item.kind === "payment" && !isCancelled && (
                        <TouchableOpacity
                          onPress={() => handleCancelPayment(item)}
                          className="ml-2 min-h-[48px] min-w-[48px] items-center justify-center"
                          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                          accessibilityRole="button"
                          accessibilityLabel={t("common.delete")}
                        >
                          <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Payment Modal */}
      <Modal
        visible={payModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPayModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-end bg-black/50"
        >
          <View className="max-h-[85%] rounded-t-3xl bg-white p-5 shadow-2xl">
            <View className="mb-4 flex-row items-center justify-between border-b border-slate-100 pb-3">
              <Text className="text-xl font-bold text-slate-900">
                {t("customers.addPayment")}
              </Text>
              <TouchableOpacity
                onPress={() => setPayModalVisible(false)}
                className="min-h-[48px] min-w-[48px] items-center justify-center"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Payment Amount */}
              <View className="mb-4">
                <AmountInput
                  label={`${t("common.amount")} (₹) *`}
                  value={payAmountRupees}
                  onChangeText={setPayAmountRupees}
                  placeholder="0"
                />
              </View>

              {/* Balance Preview */}
              <View className="mb-4 rounded-2xl bg-slate-100 p-4">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs text-slate-500">Current Balance:</Text>
                  <MoneyText paise={balancePaise} type="balance" size="sm" />
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs font-bold text-slate-700">Balance After Payment:</Text>
                  <MoneyText paise={previewBalancePaise} type="balance" size="md" />
                </View>
                {previewBalancePaise < 0 && (
                  <Text className="mt-2 text-xs font-semibold text-blue-600">
                    💡 Payment exceeds balance. An advance of ₹{paiseToRupees(Math.abs(previewBalancePaise))} will be credited.
                  </Text>
                )}
              </View>

              {/* Payment Mode Selector */}
              <View className="mb-4">
                <Text className="mb-2 text-sm font-bold text-slate-700">Payment Mode</Text>
                <View className="flex-row gap-2">
                  {PAYMENT_MODES.map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => setPayMode(mode)}
                      className={`min-h-[48px] flex-1 items-center justify-center rounded-xl border py-2 ${
                        payMode === mode
                          ? "border-emerald-600 bg-emerald-50"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold uppercase ${
                          payMode === mode ? "text-emerald-700" : "text-slate-600"
                        }`}
                      >
                        {mode}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Payment Date */}
              <View className="mb-4">
                <Text className="mb-1 text-sm font-bold text-slate-700">
                  {t("common.date")} (YYYY-MM-DD)
                </Text>
                <TextInput
                  value={payDate}
                  onChangeText={setPayDate}
                  placeholder={getTodayDateString()}
                  className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-900"
                />
              </View>

              {/* Note */}
              <View className="mb-6">
                <Text className="mb-1 text-sm font-bold text-slate-700">
                  {t("common.note")} {t("common.optional")}
                </Text>
                <TextInput
                  value={payNote}
                  onChangeText={setPayNote}
                  placeholder="UPI reference, check number, or remarks"
                  placeholderTextColor="#94a3b8"
                  className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
                />
              </View>

              <View className="mb-8 gap-3">
                <BigButton
                  title={t("customers.addPayment")}
                  onPress={handleSavePayment}
                  loading={savingPayment}
                  variant="primary"
                />
                <BigButton
                  title={t("common.cancel")}
                  onPress={() => setPayModalVisible(false)}
                  variant="outline"
                  disabled={savingPayment}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
