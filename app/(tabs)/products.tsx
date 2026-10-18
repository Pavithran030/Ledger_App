import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter, useFocusEffect } from "expo-router";
import {
  productsRepo,
  ProductWithPrice,
  ProductUnit,
} from "@/db/repositories/productsRepo";
import { SearchBar } from "@/components/SearchBar";
import { BigButton } from "@/components/BigButton";
import { MoneyText } from "@/components/MoneyText";
import { EmptyState } from "@/components/EmptyState";
import { AmountInput } from "@/components/AmountInput";
import { rupeesToPaise } from "@/utils/money";
import { Ionicons } from "@expo/vector-icons";

const UNITS: ProductUnit[] = ["bag", "kg", "litre", "packet"];

export default function ProductsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const [products, setProducts] = useState<ProductWithPrice[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Add Product Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [nameTa, setNameTa] = useState("");
  const [unit, setUnit] = useState<ProductUnit>("bag");
  const [priceRupees, setPriceRupees] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(() => {
    try {
      const data = productsRepo.listWithCurrentPrices("active");
      setProducts(data);
    } catch (e) {
      console.error("Failed to load products", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    loadProducts();
    setRefreshing(false);
  };

  const handleAddProduct = () => {
    if (!name.trim()) {
      Alert.alert(t("common.warning"), t("sale.selectProductError"));
      return;
    }
    const pricePaise = rupeesToPaise(priceRupees);
    if (pricePaise <= 0) {
      Alert.alert(t("common.warning"), t("sale.validPriceError"));
      return;
    }

    setSaving(true);
    try {
      productsRepo.createWithPrice(
        {
          name: name.trim(),
          name_ta: nameTa.trim() || null,
          unit,
        },
        pricePaise
      );

      // Reset modal
      setName("");
      setNameTa("");
      setPriceRupees("");
      setModalVisible(false);
      loadProducts();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || "Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.name_ta && p.name_ta.toLowerCase().includes(q))
    );
  });

  return (
    <View className="flex-1 bg-slate-50">
      {/* Top Header Card */}
      <View className="border-b border-slate-200 bg-white p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-black text-slate-900">{t("products.title")}</Text>
            <Text className="text-xs font-semibold text-slate-500">
              {products.length} products listed
            </Text>
          </View>
          <View className="w-36">
            <BigButton
              title={`+ ${t("products.addProduct")}`}
              onPress={() => setModalVisible(true)}
              size="md"
            />
          </View>
        </View>

        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("common.search")}
        />
      </View>

      {/* Product List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          return (
            <TouchableOpacity
              onPress={() => router.push(`/product/${item.id}`)}
              activeOpacity={0.7}
              accessibilityRole="button"
              className="min-h-[72px] mb-3 flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <View className="flex-1 pr-3">
                <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
                  {i18n.language === "ta" && item.name_ta ? item.name_ta : item.name}
                </Text>
                {i18n.language === "ta" && item.name_ta ? (
                  <Text className="text-xs text-slate-500" numberOfLines={1}>
                    {item.name}
                  </Text>
                ) : null}

                <View className="mt-1 flex-row items-center gap-2">
                  <View className="rounded-md bg-slate-100 px-2 py-0.5">
                    <Text className="text-xs font-bold text-slate-600">
                      {item.stock_qty} {item.unit}s
                    </Text>
                  </View>
                </View>
              </View>

              <View className="items-end shrink-0">
                <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t("products.currentPrice")}
                </Text>
                <MoneyText paise={item.current_price_paise || 0} type="cash" size="lg" />
                <Text className="text-[11px] font-medium text-slate-400">
                  per {item.unit}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title={searchQuery ? t("products.noProductsFound") : t("products.noProductsYet")}
            message={searchQuery ? t("products.noProductsFound") : t("products.noProductsYet")}
            actionTitle={!searchQuery ? `+ ${t("products.addProduct")}` : undefined}
            onActionPress={!searchQuery ? () => setModalVisible(true) : undefined}
          />
        }
      />

      {/* Add Product Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-end bg-black/50"
        >
          <View className="max-h-[85%] rounded-t-3xl bg-white p-5 shadow-2xl">
            <View className="mb-4 flex-row items-center justify-between border-b border-slate-100 pb-3">
              <Text className="text-xl font-bold text-slate-900">{t("products.addProduct")}</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="min-h-[48px] min-w-[48px] items-center justify-center"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Product Name */}
              <View className="mb-4">
                <Text className="mb-1 text-sm font-bold text-slate-700">
                  {t("products.productNameEn")} <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={t("products.nameEnPlaceholder")}
                  placeholderTextColor="#94a3b8"
                  className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-900"
                />
              </View>

              {/* Tamil Name */}
              <View className="mb-4">
                <Text className="mb-1 text-sm font-bold text-slate-700">
                  {t("products.productNameTa")}
                </Text>
                <TextInput
                  value={nameTa}
                  onChangeText={setNameTa}
                  placeholder={t("products.nameTaPlaceholder")}
                  placeholderTextColor="#94a3b8"
                  className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-900"
                />
              </View>

              {/* Unit Selector */}
              <View className="mb-4">
                <Text className="mb-2 text-sm font-bold text-slate-700">{t("products.unit")}</Text>
                <View className="flex-row gap-2">
                  {UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setUnit(u)}
                      className={`min-h-[48px] flex-1 items-center justify-center rounded-xl border py-2.5 ${
                        unit === u
                          ? "border-emerald-600 bg-emerald-50"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      <Text
                        className={`text-sm font-bold capitalize ${
                          unit === u ? "text-emerald-700" : "text-slate-600"
                        }`}
                      >
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Initial Price */}
              <View className="mb-4">
                <AmountInput
                  label={`${t("products.initialPrice")} (${unit}) *`}
                  value={priceRupees}
                  onChangeText={setPriceRupees}
                  placeholder="0"
                />
              </View>

              <View className="mb-8 gap-3">
                <BigButton
                  title={t("common.save")}
                  onPress={handleAddProduct}
                  loading={saving}
                  variant="primary"
                />
                <BigButton
                  title={t("common.cancel")}
                  onPress={() => setModalVisible(false)}
                  variant="outline"
                  disabled={saving}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
