import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  GestureResponderEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface BigButtonProps {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: "primary" | "secondary" | "danger" | "outline" | "whatsapp";
  disabled?: boolean;
  loading?: boolean;
  /** Pass an Ionicons name string for a built-in icon, or a ReactNode for custom content */
  icon?: React.ComponentProps<typeof Ionicons>["name"] | React.ReactNode;
  className?: string;
  size?: "md" | "lg";
}

export function BigButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
  className = "",
  size = "lg",
}: BigButtonProps) {
  // Enforce minimum 48dp touch target per non-negotiable UX rules
  const baseHeight = size === "lg" ? "min-h-[52px]" : "min-h-[48px]";

  let bgClasses = "bg-emerald-700 active:bg-emerald-800";
  let textClasses = "text-white font-bold";
  const indicatorColor =
    variant === "secondary" || variant === "outline" ? "#1e293b" : "#ffffff";

  if (variant === "secondary") {
    bgClasses = "bg-slate-200 active:bg-slate-300";
    textClasses = "text-slate-800 font-bold";
  } else if (variant === "danger") {
    bgClasses = "bg-red-600 active:bg-red-700";
    textClasses = "text-white font-bold";
  } else if (variant === "outline") {
    bgClasses = "bg-transparent border-2 border-slate-300 active:bg-slate-100";
    textClasses = "text-slate-700 font-bold";
  } else if (variant === "whatsapp") {
    bgClasses = "bg-emerald-600 active:bg-emerald-700";
    textClasses = "text-white font-bold";
  }

  if (disabled) {
    bgClasses = "bg-slate-300";
    textClasses = "text-slate-600 font-semibold";
  }

  const opacityClass = loading ? "opacity-75" : "";

  // Resolve icon: if it's a string treat it as an Ionicons name, else render as-is
  const iconColor = disabled
    ? "#94a3b8"
    : variant === "secondary" || variant === "outline"
    ? "#1e293b"
    : "#ffffff";

  const resolvedIcon =
    typeof icon === "string" ? (
      <Ionicons name={icon as React.ComponentProps<typeof Ionicons>["name"]} size={20} color={iconColor} />
    ) : (
      icon ?? null
    );

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      className={`w-full flex-row items-center justify-center rounded-xl px-5 py-3 ${baseHeight} ${bgClasses} ${opacityClass} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <>
          {resolvedIcon ? (
            <View style={{ marginRight: 8 }}>{resolvedIcon}</View>
          ) : null}
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className={`text-center text-base ${textClasses}`}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
