import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BigButton } from "./BigButton";

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionTitle?: string;
  onActionPress?: () => void;
}

export function EmptyState({
  icon = "file-tray-outline",
  title,
  message,
  actionTitle,
  onActionPress,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <Ionicons name={icon} size={32} color="#94a3b8" />
      </View>
      <Text className="text-center text-lg font-bold text-slate-800">{title}</Text>
      {message && <Text className="mt-1 text-center text-sm text-slate-500">{message}</Text>}
      {actionTitle && onActionPress && (
        <View className="mt-6 w-full max-w-xs">
          <BigButton title={actionTitle} onPress={onActionPress} />
        </View>
      )}
    </View>
  );
}
