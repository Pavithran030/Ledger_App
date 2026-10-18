import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { productsRepo, Product } from "@/db/repositories/productsRepo";
import { pricesRepo, PriceRecord } from "@/db/repositories/pricesRepo";
import { MoneyText } from "@/components/MoneyText";
import { BigButton } from "@/components/BigButton";
import { AmountInput } from "@/components/AmountInput";
import { paiseToRupees, rupeesToPaise } from "@/utils/money";
import { formatDate } from "@/utils/dates";
import { Ionicons } from "@expo/vector-icons";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const [product, setProduct] = useState<Product | null>(null);
  const [currentPricePaise, setCurrentPricePaise] = useState<number | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceRecord[]>([]);

  // Update Price Modal
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [newPriceRupees, setNewPriceRupees] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  // Stock Adjustment Modal
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [stockAction, setStockAction] = useState<"add" | "reduce">("add");
  const [stockQtyInput, setStockQtyInput] = useState("");
  const [stockReason, setStockReason] = useState("purchase");
  const [savingStock, setSavingStock] = useState(false);

  const loadData = useCallback(() => {
    if (!id) return;
    try {
      const prod = productsRepo.getById(id);
      if (!prod) {
        Alert.alert(t("common.error"), "Product not found");
        router.back();
        return;
      }
      setProduct(prod);

      const price = pricesRepo.getCurrentPrice(id);
      setCurrentPricePaise(price);

      const history = pricesRepo.getHistory(id);
      setPriceHistory(history);
    } catch (e) {
      console.error("Failed to load product", e);
    }
  }, [id, router, t]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleUpdatePrice = () => {
    const pricePaise = rupeesToPaise(newPriceRupees);
    if (pricePaise <= 0) {
      Alert.alert(t("common.warning"), t("sale.validPriceError"));
      return;
    }
    if (!product) return;

    setSavingPrice(true);
    try {
      pricesRepo.addPrice(product.id, pricePaise);
      setNewPriceRupees("");
      setPriceModalVisible(false);
      loadData();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || "Failed to update price");
    } finally {
      setSavingPrice(false);
    }
  };

  const handleStockChange = () => {
    const rawQty = parseFloat(stockQtyInput);
    if (isNaN(rawQty) || rawQty <= 0) {
      Alert.alert(t("common.warning"), t("sale.validQtyError"));
      return;
    }
    if (!product) return;

    const delta = stockAction === "add" ? Math.abs(rawQty) : -Math.abs(rawQty);

    setSavingStock(true);
    try {
      productsRepo.adjustStock(product.id, delta, stockReason);
      setStockQtyInput("");
      setStockModalVisible(false);
      loadData();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || "Failed to update stock");
    } finally {
      setSavingStock(false);
    }
  };

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Text className="text-slate-500">{t("common.loading")}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Product Hero Card */}
      <View className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-2xl font-black text-slate-900">
              {i18n.language === "ta" && product.name_ta ? product.name_ta : product.name}
            </Text>
            {i18n.language === "ta" && product.name_ta ? (
              <Text className="text-xs text-slate-500">{product.name}</Text>
            ) : null}
            <Text className="mt-1 text-xs font-bold uppercase text-slate-400">
              Unit: {product.unit}
            </Text>
          </View>
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
            <Ionicons name="cube-outline" size={24} color="#059669" />
          </View>
        </View>

        {/* Stock & Price Row */}
        <View className="mt-5 flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t("products.stock")}
            </Text>
            <View className="mt-1 flex-row items-center gap-1.5">
              <Text className="text-2xl font-black text-slate-900">
                {product.stock_qty}
              </Text>
              <Text className="text-xs font-bold text-slate-400">{product.unit}s</Text>
            </View>
          </View>

          <View className="flex-1 rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t("products.currentPrice")}
            </Text>
            <View className="mt-1">
              <MoneyText paise={currentPricePaise || 0} type="cash" size="2xl" />
            </View>
            <Text className="mt-1 text-[11px] text-slate-400">
              per {product.unit}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1">
            <BigButton
              title={t("products.updatePrice")}
              onPress={() => setPriceModalVisible(true)}
              variant="outline"
              size="md"
            />
          </View>
          <View className="flex-1">
            <BigButton
              title="Adjust Stock"
              onPress={() => setStockModalVisible(true)}
              variant="secondary"
              size="md"
            />
          </View>
        </View>
      </View>

      {/* Immutable Price History */}
      <View className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-slate-900">{t("products.priceHistory")}</Text>
          <Text className="text-xs text-slate-400">{priceHistory.length} price points</Text>
        </View>

        <View className="divide-y divide-slate-100">
          {priceHistory.map((ph, index) => (
            <View key={ph.id} className="flex-row items-center justify-between py-3">
              <View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-bold text-slate-800">
                    ₹{paiseToRupees(ph.price_paise)} / {product.unit}
                  </Text>
                  {index === 0 && (
                    <View className="rounded bg-emerald-100 px-1.5 py-0.5">
                      <Text className="text-[10px] font-bold text-emerald-800">ACTIVE</Text>
                    </View>
                  )}
                </View>
                <Text className="text-xs text-slate-400">
                  Effective from: {formatDate(ph.effective_from)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Update Price Modal */}
      <Modal
        visible={priceModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPriceModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 items-center justify-center bg-black/50 p-4"
        >
          <View className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <Text className="text-xl font-bold text-slate-900">{t("products.updatePrice")}</Text>
            <Text className="mt-1 text-xs text-slate-500">
              Adds a new price point. Historical bills retain the price at sale time.
            </Text>

            <View className="my-5">
              <AmountInput
                label={`New Selling Price per ${product.unit} (₹)`}
                value={newPriceRupees}
                onChangeText={setNewPriceRupees}
                placeholder="0"
              />
            </View>

            <View className="gap-2">
              <BigButton
                title={t("common.save")}
                onPress={handleUpdatePrice}
                loading={savingPrice}
              />
              <BigButton
                title={t("common.cancel")}
                onPress={() => setPriceModalVisible(false)}
                variant="outline"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Stock Change Modal */}
      <Modal
        visible={stockModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setStockModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 items-center justify-center bg-black/50 p-4"
        >
          <View className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <Text className="text-xl font-bold text-slate-900">Stock Adjustment</Text>
            <Text className="mt-1 text-xs text-slate-500">
              Add new inventory received or record damaged/lost stock.
            </Text>

            {/* Segmented Add vs Reduce */}
            <View className="mt-4 flex-row rounded-xl bg-slate-100 p-1">
              <TouchableOpacity
                onPress={() => setStockAction("add")}
                className={`min-h-[44px] flex-1 items-center justify-center rounded-lg ${
                  stockAction === "add" ? "bg-white" : ""
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    stockAction === "add" ? "text-emerald-700" : "text-slate-600"
                  }`}
                >
                  + Add Stock
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStockAction("reduce")}
                className={`min-h-[44px] flex-1 items-center justify-center rounded-lg ${
                  stockAction === "reduce" ? "bg-white" : ""
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    stockAction === "reduce" ? "text-red-700" : "text-slate-600"
                  }`}
                >
                  - Reduce / Loss
                </Text>
              </TouchableOpacity>
            </View>

            <View className="my-4">
              <Text className="mb-1 text-sm font-semibold text-slate-700">
                Quantity ({product.unit}s)
              </Text>
              <TextInput
                value={stockQtyInput}
                onChangeText={setStockQtyInput}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
                className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-xl font-bold text-slate-900"
              />
            </View>

            <View className="mb-5 flex-row gap-2">
              <TouchableOpacity
                onPress={() => setStockReason("purchase")}
                className={`min-h-[48px] flex-1 items-center justify-center rounded-xl border py-2 ${
                  stockReason === "purchase"
                    ? "border-emerald-600 bg-emerald-50"
                    : "border-slate-300"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    stockReason === "purchase" ? "text-emerald-700" : "text-slate-600"
                  }`}
                >
                  Purchase
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStockReason("adjustment")}
                className={`min-h-[48px] flex-1 items-center justify-center rounded-xl border py-2 ${
                  stockReason === "adjustment"
                    ? "border-emerald-600 bg-emerald-50"
                    : "border-slate-300"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    stockReason === "adjustment" ? "text-emerald-700" : "text-slate-600"
                  }`}
                >
                  Manual Adj.
                </Text>
              </TouchableOpacity>
            </View>

            <View className="gap-2">
              <BigButton
                title={t("common.save")}
                onPress={handleStockChange}
                loading={savingStock}
              />
              <BigButton
                title={t("common.cancel")}
                onPress={() => setStockModalVisible(false)}
                variant="outline"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}
