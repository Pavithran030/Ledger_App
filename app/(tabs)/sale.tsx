import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { productsRepo, ProductWithPrice } from "@/db/repositories/productsRepo";
import { billsRepo } from "@/db/repositories/billsRepo";
import { balanceService, CustomerWithBalance } from "@/services/balance";
import { calculateLineAmountPaise, paiseToRupees, rupeesToPaise } from "@/utils/money";
import { getTodayDateString } from "@/utils/dates";
import { BigButton } from "@/components/BigButton";
import { AmountInput } from "@/components/AmountInput";
import { SearchBar } from "@/components/SearchBar";
import { MoneyText } from "@/components/MoneyText";
import { Ionicons } from "@expo/vector-icons";

interface CartItem {
  id: string;
  product_id: string;
  name: string;
  name_ta: string | null;
  unit: string;
  stock_qty: number;
  qty: number;
  price_paise: number;
}

export default function SaleScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    customerId?: string;
    customerName?: string;
  }>();

  // One single sales flow. Selecting a customer turns the sale into a customer
  // account (khatta) entry; no customer means a paid walk-in cash sale.
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithBalance | null>(null);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Money received now
  const [receivedStr, setReceivedStr] = useState("");
  const [receivedEdited, setReceivedEdited] = useState(false);

  // Add Item Modal
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [allProducts, setAllProducts] = useState<ProductWithPrice[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithPrice | null>(null);
  const [itemQtyStr, setItemQtyStr] = useState("1");
  const [itemPriceRupees, setItemPriceRupees] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const [saving, setSaving] = useState(false);

  const loadInitialData = useCallback(() => {
    try {
      const prods = productsRepo.listWithCurrentPrices("active");
      setAllProducts(prods);
      const custs = balanceService.getAllBalances("active");
      setCustomers(custs);

      // Handle query param pre-selection if passed
      if (params.customerId) {
        const found = custs.find((c) => c.id === params.customerId);
        if (found) {
          setSelectedCustomer(found);
        } else if (params.customerName) {
          setSelectedCustomer({
            id: params.customerId,
            name: params.customerName,
            phone: null,
            village: null,
            credit_limit_paise: 0,
            notes: null,
            status: "active",
            created_at: "",
            updated_at: "",
            synced_at: null,
            balance_paise: 0,
          });
        }
      }
    } catch {
      // Error handling
    }
  }, [params.customerId, params.customerName]);

  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [loadInitialData])
  );

  // Grand Total Calculation
  const grandTotalPaise = cart.reduce(
    (sum, item) => sum + calculateLineAmountPaise(item.qty, item.price_paise),
    0
  );

  // Keep the "Amount Received Now" field pre-filled with the full total until
  // the owner edits it manually.
  useEffect(() => {
    if (!receivedEdited) {
      setReceivedStr(grandTotalPaise > 0 ? String(paiseToRupees(grandTotalPaise)) : "");
    }
  }, [grandTotalPaise, receivedEdited]);

  const receivedPaise = rupeesToPaise(receivedStr);
  const previousBalancePaise = selectedCustomer?.balance_paise || 0;
  const newBalancePaise = previousBalancePaise + grandTotalPaise - receivedPaise;

  const handleOpenAddItem = () => {
    setSelectedProduct(null);
    setItemQtyStr("1");
    setItemPriceRupees("");
    setProductSearch("");
    setItemModalVisible(true);
  };

  const handleSelectProduct = (prod: ProductWithPrice) => {
    setSelectedProduct(prod);
    const priceRupees = prod.current_price_paise
      ? (paiseToRupees(prod.current_price_paise)).toString()
      : "0";
    setItemPriceRupees(priceRupees);
  };

  const handleConfirmAddItem = () => {
    if (!selectedProduct) {
      Alert.alert(t("sale.validation"), t("sale.selectProductError"));
      return;
    }
    const qty = parseFloat(itemQtyStr);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert(t("sale.validation"), t("sale.validQtyError"));
      return;
    }
    const pricePaise = rupeesToPaise(itemPriceRupees);
    if (pricePaise <= 0) {
      Alert.alert(t("sale.validation"), t("sale.validPriceError"));
      return;
    }

    const newItem: CartItem = {
      id: `${selectedProduct.id}-${Date.now()}`,
      product_id: selectedProduct.id,
      name: selectedProduct.name,
      name_ta: selectedProduct.name_ta,
      unit: selectedProduct.unit,
      stock_qty: selectedProduct.stock_qty,
      qty,
      price_paise: pricePaise,
    };

    setCart((prev) => [...prev, newItem]);
    setItemModalVisible(false);
  };

  const handleRemoveItem = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSaveSale = () => {
    if (cart.length === 0) {
      Alert.alert(t("sale.emptySale"), t("sale.addAtLeastOne"));
      return;
    }
    // Walk-in sales have no customer to carry a pending balance.
    if (!selectedCustomer && receivedPaise < grandTotalPaise) {
      Alert.alert(t("sale.validation"), t("sale.walkInNeedsFullPayment"));
      return;
    }

    // Check low/negative stock warnings
    const lowStockItems = cart.filter((item) => item.qty > item.stock_qty);
    if (lowStockItems.length > 0) {
      const itemNames = lowStockItems.map((i) => i.name).join(", ");
      Alert.alert(
        t("dialogs.lowStockWarning"),
        t("dialogs.lowStockDetail", {
          name: itemNames,
          stock: lowStockItems[0].stock_qty,
          unit: lowStockItems[0].unit,
        }),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.confirm"), onPress: () => processSale() },
        ]
      );
      return;
    }

    // Check Credit Limit Warning
    if (selectedCustomer && selectedCustomer.credit_limit_paise > 0) {
      if (newBalancePaise > selectedCustomer.credit_limit_paise) {
        Alert.alert(
          t("dialogs.creditLimitExceeded"),
          t("dialogs.creditLimitDetail", {
            name: selectedCustomer.name,
            limit: paiseToRupees(selectedCustomer.credit_limit_paise),
          }),
          [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("dialogs.allowSale"), onPress: () => processSale() },
          ]
        );
        return;
      }
    }

    processSale();
  };

  const processSale = () => {
    setSaving(true);
    try {
      const today = getTodayDateString();
      const created = billsRepo.createBill({
        customer_id: selectedCustomer?.id || null,
        type: selectedCustomer ? "credit" : "cash",
        bill_date: today,
        due_date: selectedCustomer ? dueDate.trim() || null : null,
        note: note.trim() || null,
        items: cart.map((i) => ({
          product_id: i.product_id,
          qty: i.qty,
          price_paise: i.price_paise,
        })),
        // Money handed over at the sale is recorded as a payment in the same
        // transaction, so the derived balance stays correct.
        payment:
          selectedCustomer && receivedPaise > 0
            ? { amount_paise: receivedPaise, mode: "cash", pay_date: today }
            : null,
      });

      // Reset Form
      setCart([]);
      setSelectedCustomer(null);
      setNote("");
      setDueDate("");
      setReceivedStr("");
      setReceivedEdited(false);
      router.push(`/bill/${created.id}`);
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || "Failed to complete sale");
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.village && c.village.toLowerCase().includes(q))
    );
  });

  const filteredProducts = allProducts.filter((p) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.name_ta && p.name_ta.toLowerCase().includes(q))
    );
  });

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {/* Customer Selector (optional — selecting one tracks credit) */}
        <View className="mb-4">
          {selectedCustomer ? (
            <View className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-lg font-bold text-slate-900">
                    {selectedCustomer.name}
                  </Text>
                  <Text className="text-xs text-slate-500">
                    {selectedCustomer.village || selectedCustomer.phone || ""}
                  </Text>
                  <View className="mt-1 flex-row items-center">
                    <Text className="text-xs font-semibold text-slate-600">
                      {t("customers.pendingBalance")}:{" "}
                    </Text>
                    <MoneyText paise={selectedCustomer.balance_paise} type="balance" size="sm" />
                  </View>
                </View>

                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => router.push(`/customer/${selectedCustomer.id}`)}
                    className="min-h-[48px] items-center justify-center rounded-xl bg-white px-4 border border-slate-300 shadow-sm"
                  >
                    <Text className="text-xs font-bold text-emerald-800">
                      {t("customers.ledger")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setCustomerModalVisible(true)}
                    className="min-h-[48px] items-center justify-center rounded-xl bg-white px-4 border border-slate-300 shadow-sm"
                  >
                    <Text className="text-xs font-bold text-amber-800">
                      {t("common.change")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setCustomerModalVisible(true)}
              className="min-h-[56px] flex-row items-center justify-between rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50/30 px-4 py-3"
            >
              <View className="flex-row items-center">
                <Ionicons name="person-add-outline" size={20} color="#b45309" />
                <Text className="ml-2 font-bold text-amber-900">
                  {t("sale.tapToSelectCustomer")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#b45309" />
            </TouchableOpacity>
          )}
        </View>

        {/* Items Section */}
        <View className="mb-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-bold text-slate-800">
              {t("sale.saleItems", { count: cart.length })}
            </Text>
            <TouchableOpacity
              onPress={handleOpenAddItem}
              className="min-h-[48px] flex-row items-center justify-center rounded-xl bg-emerald-50 px-4 border border-emerald-200"
            >
              <Ionicons name="add" size={18} color="#047857" />
              <Text className="ml-1 text-sm font-bold text-emerald-800">{t("sale.addItem")}</Text>
            </TouchableOpacity>
          </View>

          {cart.length === 0 ? (
            <View className="items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <Ionicons name="cart-outline" size={36} color="#cbd5e1" />
              <Text className="mt-2 text-center text-sm font-medium text-slate-500">
                {t("sale.noItemsAdded")}
              </Text>
            </View>
          ) : (
            <View className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              {cart.map((item) => {
                const lineAmountPaise = calculateLineAmountPaise(item.qty, item.price_paise);
                return (
                  <View key={item.id} className="flex-row items-center justify-between py-3 px-2">
                    <View className="flex-1 pr-2">
                      <Text className="text-base font-bold text-slate-900">{item.name}</Text>
                      <Text className="text-xs text-slate-500">
                        {item.qty} {item.unit}s @ {paiseToRupees(item.price_paise)}/unit
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <MoneyText paise={lineAmountPaise} type="cash" size="md" />
                      <TouchableOpacity
                        onPress={() => handleRemoveItem(item.id)}
                        className="min-h-[48px] min-w-[48px] items-center justify-center"
                        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                        accessibilityRole="button"
                        accessibilityLabel={t("common.delete")}
                      >
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Amount Received Now + Balance Preview */}
        <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <AmountInput
            label={t("sale.amountReceivedNow")}
            value={receivedStr}
            onChangeText={(txt) => {
              setReceivedEdited(true);
              setReceivedStr(txt);
            }}
            placeholder="0"
          />

          {selectedCustomer ? (
            <View className="mt-3 rounded-xl bg-slate-100 p-3">
              <View className="flex-row items-center justify-between py-0.5">
                <Text className="text-xs font-semibold text-slate-500">
                  {t("sale.previousBalance")}
                </Text>
                <MoneyText paise={previousBalancePaise} type="balance" size="sm" />
              </View>
              <View className="flex-row items-center justify-between py-0.5">
                <Text className="text-xs font-semibold text-slate-500">
                  {t("sale.thisSale")}
                </Text>
                <MoneyText paise={grandTotalPaise} type="credit" size="sm" />
              </View>
              <View className="flex-row items-center justify-between py-0.5">
                <Text className="text-xs font-semibold text-slate-500">
                  {t("sale.receivedNow")}
                </Text>
                <MoneyText paise={receivedPaise} type="payment" size="sm" />
              </View>
              <View className="mt-2 flex-row items-center justify-between border-t border-slate-200 pt-2">
                <Text className="text-sm font-bold text-slate-700">
                  {t("sale.newBalance")}
                </Text>
                <MoneyText paise={newBalancePaise} type="balance" size="md" />
              </View>
            </View>
          ) : (
            <Text className="mt-2 text-xs font-semibold text-amber-700">
              {t("sale.walkInHint")}
            </Text>
          )}
        </View>

        {/* Due Date & Notes */}
        <View className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {selectedCustomer && (
            <View className="mb-3">
              <Text className="mb-1 text-sm font-semibold text-slate-700">
                {t("sale.dueDate")} {t("common.optional")}
              </Text>
              <TextInput
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
                className="min-h-[48px] rounded-xl border border-slate-300 bg-slate-50 px-3 text-base font-medium text-slate-800"
              />
            </View>
          )}

          <View>
            <Text className="mb-1 text-sm font-semibold text-slate-700">
              {t("common.note")} {t("common.optional")}
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t("sale.saleNotes")}
              placeholderTextColor="#94a3b8"
              className="min-h-[48px] rounded-xl border border-slate-300 bg-slate-50 px-3 text-base font-medium text-slate-800"
            />
          </View>
        </View>

        {/* Bill Total & Save */}
        <View className="mb-8 rounded-2xl bg-slate-900 p-5 shadow-lg">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-slate-300">{t("sale.total")}</Text>
            <MoneyText paise={grandTotalPaise} type="cash" size="2xl" className="text-white font-black" />
          </View>

          <View className="mt-4">
            <BigButton
              title={t("sale.saveSale")}
              onPress={handleSaveSale}
              loading={saving}
              variant="primary"
            />
          </View>
        </View>
      </ScrollView>

      {/* Customer Selection Modal */}
      <Modal
        visible={customerModalVisible}
        animationType="slide"
        onRequestClose={() => setCustomerModalVisible(false)}
      >
        <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-slate-50 p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-slate-900">{t("sale.selectCustomer")}</Text>
            <TouchableOpacity
              onPress={() => setCustomerModalVisible(false)}
              className="min-h-[48px] min-w-[48px] items-center justify-center"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={26} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Quick Add Customer Button */}
          <TouchableOpacity
            onPress={() => {
              setCustomerModalVisible(false);
              router.push("/customer/new");
            }}
            className="mb-3 min-h-[48px] flex-row items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 py-2.5 px-4"
          >
            <Ionicons name="person-add-outline" size={20} color="#047857" />
            <Text className="ml-2 font-bold text-emerald-800">{t("customers.addCustomer")}</Text>
          </TouchableOpacity>

          {/* Walk-in option: clear the selected customer */}
          <TouchableOpacity
            onPress={() => {
              setSelectedCustomer(null);
              setCustomerModalVisible(false);
            }}
            className="mb-3 min-h-[48px] flex-row items-center justify-center rounded-xl bg-slate-100 border border-slate-200 py-2.5 px-4"
          >
            <Ionicons name="walk-outline" size={20} color="#475569" />
            <Text className="ml-2 font-bold text-slate-700">{t("sale.walkIn")}</Text>
          </TouchableOpacity>

          <SearchBar
            value={customerSearch}
            onChangeText={setCustomerSearch}
            placeholder={t("common.search")}
          />

          <ScrollView className="mt-4 flex-1" keyboardShouldPersistTaps="handled">
            {filteredCustomers.map((cust) => (
              <TouchableOpacity
                key={cust.id}
                onPress={() => {
                  setSelectedCustomer(cust);
                  setCustomerModalVisible(false);
                }}
                className="mb-2 min-h-[56px] rounded-xl border border-slate-200 bg-white p-4"
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-base font-bold text-slate-900">{cust.name}</Text>
                    <Text className="text-xs text-slate-500">{cust.village || cust.phone || ""}</Text>
                  </View>
                  <MoneyText paise={cust.balance_paise} type="balance" size="sm" />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Item Modal */}
      <Modal
        visible={itemModalVisible}
        animationType="slide"
        onRequestClose={() => setItemModalVisible(false)}
      >
        <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-slate-50">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1 p-4"
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-slate-900">{t("sale.addItem")}</Text>
              <TouchableOpacity
                onPress={() => setItemModalVisible(false)}
                className="min-h-[48px] min-w-[48px] items-center justify-center"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={26} color="#64748b" />
              </TouchableOpacity>
            </View>

            {!selectedProduct ? (
              <View className="flex-1">
                <SearchBar
                  value={productSearch}
                  onChangeText={setProductSearch}
                  placeholder={t("sale.searchProduct")}
                />
                <ScrollView className="mt-4 flex-1" keyboardShouldPersistTaps="handled">
                  {filteredProducts.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => handleSelectProduct(p)}
                      className="mb-2 min-h-[56px] rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <View className="flex-row items-center justify-between">
                        <View>
                          <Text className="text-base font-bold text-slate-900">
                            {i18n.language === "ta" && p.name_ta ? p.name_ta : p.name}
                          </Text>
                          <Text className="text-xs text-slate-500">
                            {t("sale.availableInStock", { qty: p.stock_qty, unit: p.unit })}
                          </Text>
                        </View>
                        <MoneyText paise={p.current_price_paise || 0} type="cash" size="md" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <ScrollView className="mt-2 flex-1" keyboardShouldPersistTaps="handled">
                <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-lg font-bold text-slate-900">{selectedProduct.name}</Text>
                    <TouchableOpacity
                      onPress={() => setSelectedProduct(null)}
                      className="min-h-[48px] justify-center px-3"
                    >
                      <Text className="text-xs font-bold text-emerald-700">
                        {t("sale.changeProduct")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text className="mt-1 text-xs text-slate-500">
                    {t("sale.availableInStock", {
                      qty: selectedProduct.stock_qty,
                      unit: selectedProduct.unit,
                    })}
                  </Text>
                </View>

                {/* Quantity */}
                <View className="mb-4">
                  <Text className="mb-1 text-sm font-bold text-slate-700">
                    {t("sale.quantity")} ({selectedProduct.unit}s)
                  </Text>
                  <TextInput
                    value={itemQtyStr}
                    onChangeText={setItemQtyStr}
                    placeholder="1"
                    keyboardType="decimal-pad"
                    className="min-h-[52px] rounded-xl border border-slate-300 bg-white px-4 text-2xl font-black text-slate-900"
                  />
                </View>

                {/* Price per unit (editable override) */}
                <View className="mb-4">
                  <AmountInput
                    label={`${t("sale.price")} per ${selectedProduct.unit} (₹)`}
                    value={itemPriceRupees}
                    onChangeText={setItemPriceRupees}
                    placeholder="0"
                  />
                </View>

                {/* Live Line Total */}
                <View className="mb-6 rounded-2xl bg-slate-100 p-4">
                  <Text className="text-xs font-bold text-slate-500">{t("sale.total")}</Text>
                  <MoneyText
                    paise={calculateLineAmountPaise(
                      parseFloat(itemQtyStr) || 0,
                      rupeesToPaise(itemPriceRupees)
                    )}
                    type="cash"
                    size="2xl"
                  />
                </View>

                <View className="gap-2">
                  <BigButton
                    title={t("sale.addToBill")}
                    onPress={handleConfirmAddItem}
                    variant="primary"
                  />
                  <BigButton
                    title={t("common.cancel")}
                    onPress={() => setItemModalVisible(false)}
                    variant="outline"
                  />
                </View>
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
