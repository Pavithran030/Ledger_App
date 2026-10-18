import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { customersRepo } from "@/db/repositories/customersRepo";
import { billsRepo } from "@/db/repositories/billsRepo";
import { AmountInput } from "@/components/AmountInput";
import { BigButton } from "@/components/BigButton";
import { rupeesToPaise } from "@/utils/money";
import { sanitizeIndianPhone } from "@/utils/phone";

const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  phoneRaw: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const digits = val.replace(/\D/g, "");
    return digits.length === 10 || (digits.length === 11 && digits.startsWith("0")) || (digits.length === 12 && digits.startsWith("91"));
  }, "Enter a valid 10-digit mobile number"),
  village: z.string().optional(),
  creditLimitRupees: z.string().optional(),
  openingBalanceRupees: z.string().optional(),
  notes: z.string().optional(),
});

export default function NewCustomerScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [name, setName] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [village, setVillage] = useState("");
  const [creditLimitRupees, setCreditLimitRupees] = useState("");
  const [openingBalanceRupees, setOpeningBalanceRupees] = useState("");
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleAddCustomer = () => {
    setErrors({});
    const validation = customerSchema.safeParse({
      name: name.trim(),
      phoneRaw: phoneRaw.trim(),
      village: village.trim(),
      creditLimitRupees,
      openingBalanceRupees,
      notes: notes.trim(),
    });

    if (!validation.success) {
      const errMap: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        if (issue.path[0]) {
          errMap[issue.path[0] as string] = issue.message;
        }
      }
      setErrors(errMap);
      return;
    }

    setSaving(true);
    try {
      const formattedPhone = sanitizeIndianPhone(phoneRaw);
      const creditLimitPaise = rupeesToPaise(creditLimitRupees);
      const openingBalancePaise = rupeesToPaise(openingBalanceRupees);

      // 1. Create customer through repository
      const customer = customersRepo.create({
        name: name.trim(),
        phone: formattedPhone,
        village: village.trim() || null,
        credit_limit_paise: creditLimitPaise,
        notes: notes.trim() || null,
      });

      // 2. If opening balance entered, record an opening credit bill through repository
      if (openingBalancePaise > 0) {
        billsRepo.createOpeningBalanceBill(
          customer.id,
          openingBalancePaise,
          "Opening Balance (Notebook)"
        );
      }

      router.back();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || "Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-slate-50"
    >
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          {/* Customer Name */}
          <View className="mb-4">
            <Text className="mb-1 text-sm font-bold text-slate-700">
              {t("common.name")} <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("customers.customerName")}
              placeholderTextColor="#94a3b8"
              className={`min-h-[48px] rounded-xl border px-4 text-base font-semibold text-slate-900 ${
                errors.name ? "border-red-500 bg-red-50" : "border-slate-300 bg-white"
              }`}
            />
            {errors.name && <Text className="mt-1 text-xs font-semibold text-red-500">{errors.name}</Text>}
          </View>

          {/* Phone Number */}
          <View className="mb-4">
            <Text className="mb-1 text-sm font-bold text-slate-700">{t("common.phone")}</Text>
            <View
              className={`min-h-[48px] flex-row items-center rounded-xl border px-3 ${
                errors.phoneRaw ? "border-red-500 bg-red-50" : "border-slate-300 bg-white"
              }`}
            >
              <Text className="mr-2 text-base font-bold text-slate-500">+91</Text>
              <TextInput
                value={phoneRaw}
                onChangeText={setPhoneRaw}
                placeholder={t("customers.customerPhone")}
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                maxLength={12}
                className="flex-1 text-base font-semibold text-slate-900"
              />
            </View>
            {errors.phoneRaw && <Text className="mt-1 text-xs font-semibold text-red-500">{errors.phoneRaw}</Text>}
            <Text className="mt-1 text-xs text-slate-400">Used for one-tap WhatsApp balance updates</Text>
          </View>

          {/* Village */}
          <View className="mb-4">
            <Text className="mb-1 text-sm font-bold text-slate-700">{t("common.village")}</Text>
            <TextInput
              value={village}
              onChangeText={setVillage}
              placeholder={t("customers.customerVillage")}
              placeholderTextColor="#94a3b8"
              className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-900"
            />
          </View>

          {/* Opening Balance (Migration from Notebook) */}
          <View className="mb-4 rounded-2xl bg-amber-50 p-4 border border-amber-200">
            <Text className="mb-1 text-sm font-bold text-amber-900">
              {t("customers.openingBalance")}
            </Text>
            <Text className="mb-2 text-xs text-amber-700">
              Existing credit amount owed by the farmer from physical ledger
            </Text>
            <AmountInput
              value={openingBalanceRupees}
              onChangeText={setOpeningBalanceRupees}
              placeholder="0"
            />
          </View>

          {/* Credit Limit */}
          <View className="mb-4">
            <AmountInput
              label={`${t("customers.creditLimit")} (₹) ${t("common.optional")}`}
              value={creditLimitRupees}
              onChangeText={setCreditLimitRupees}
              placeholder="0"
            />
            <Text className="mt-1 text-xs text-slate-400">
              Warns during billing if customer's credit balance exceeds this limit
            </Text>
          </View>

          {/* Notes */}
          <View className="mb-6">
            <Text className="mb-1 text-sm font-bold text-slate-700">
              {t("common.note")} {t("common.optional")}
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t("customers.customerNotes")}
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              className="min-h-[72px] rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800"
            />
          </View>

          {/* Buttons */}
          <View className="gap-3">
            <BigButton
              title={t("customers.addCustomer")}
              onPress={handleAddCustomer}
              loading={saving}
              variant="primary"
            />
            <BigButton
              title={t("common.cancel")}
              onPress={() => router.back()}
              variant="outline"
              disabled={saving}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
