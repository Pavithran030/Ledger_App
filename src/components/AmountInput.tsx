import React, { useRef, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";

export interface AmountInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  editable?: boolean;
}

export function AmountInput({
  label,
  value,
  onChangeText,
  placeholder = "0",
  error,
  editable = true,
}: AmountInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (text: string) => {
    // Only allow numbers and at most one decimal point
    const cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return;
    }
    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      return;
    }
    onChangeText(cleaned);
  };

  const borderClass = error
    ? "border-red-500"
    : isFocused
    ? "border-emerald-600 border-2"
    : "border-slate-300";

  return (
    <View className="w-full">
      {label && <Text className="mb-1 text-sm font-semibold text-slate-700">{label}</Text>}
      <Pressable
        onPress={() => editable && inputRef.current?.focus()}
        className={`min-h-[52px] flex-row items-center rounded-xl border bg-white px-4 py-2 ${borderClass} ${
          !editable ? "bg-slate-100" : ""
        }`}
      >
        <Text
          className={`mr-2 text-2xl font-bold ${
            isFocused ? "text-emerald-700" : "text-slate-500"
          }`}
        >
          ₹
        </Text>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType="decimal-pad"
          editable={editable}
          accessibilityLabel={label || "Amount in Rupees"}
          className={`flex-1 text-2xl font-extrabold ${
            editable ? "text-slate-900" : "text-slate-500"
          }`}
        />
      </Pressable>
      {error && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="mt-1 text-xs font-semibold text-red-500"
        >
          {error}
        </Text>
      )}
    </View>
  );
}
