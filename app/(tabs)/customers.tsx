import React, { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter, useFocusEffect } from "expo-router";
import { balanceService, CustomerWithBalance } from "@/services/balance";
import { CustomerCard } from "@/components/CustomerCard";
import { SearchBar } from "@/components/SearchBar";
import { BigButton } from "@/components/BigButton";
import { EmptyState } from "@/components/EmptyState";
import { MoneyText } from "@/components/MoneyText";
import { Ionicons } from "@expo/vector-icons";

export default function CustomersScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadCustomers = useCallback(() => {
    try {
      const list = balanceService.getAllBalances("active");
      setCustomers(list);
    } catch {
      setCustomers([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [loadCustomers])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCustomers();
    setRefreshing(false);
  }, [loadCustomers]);

  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.village && c.village.toLowerCase().includes(q))
    );
  });

  const totalOutstandingPaise = customers.reduce(
    (sum, c) => sum + (c.balance_paise > 0 ? c.balance_paise : 0),
    0
  );

  return (
    <View className="flex-1 bg-slate-50">
      {/* Top Header Summary & Action */}
      <View className="border-b border-slate-200 bg-white p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("home.totalPending")}
            </Text>
            <MoneyText paise={totalOutstandingPaise} type="balance" size="xl" />
          </View>
          {/* Action buttons: Import + Add */}
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => router.push("/contacts-import")}
              accessibilityRole="button"
              accessibilityLabel={t("contacts.importFromPhone")}
              className="h-12 w-12 items-center justify-center rounded-xl border border-blue-200 bg-blue-50"
            >
              <Ionicons name="person-add-outline" size={22} color="#2563eb" />
            </TouchableOpacity>
            <View className="w-36">
              <BigButton
                title={`+ ${t("customers.addCustomer")}`}
                onPress={() => router.push("/customer/new")}
                size="md"
              />
            </View>
          </View>
        </View>

        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("common.search")}
        />
      </View>

      {/* Customer List */}
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CustomerCard customer={item} />}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={searchQuery ? t("customers.noCustomersFound") : t("customers.noCustomersYet")}
            message={searchQuery ? t("customers.noCustomersFound") : t("customers.addFirstCustomer")}
            actionTitle={!searchQuery ? `+ ${t("customers.addCustomer")}` : undefined}
            onActionPress={!searchQuery ? () => router.push("/customer/new") : undefined}
          />
        }
      />
    </View>
  );
}
