import React from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View className="flex-1 bg-slate-50 p-4">
      <Text className="text-xl font-bold text-slate-900">Bill Details</Text>
      <Text className="text-slate-500">Bill ID: {id}</Text>
    </View>
  );
}
