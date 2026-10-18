import React from "react";
import { Text } from "react-native";
import { formatINR, paiseToRupees } from "@/utils/money";

export interface MoneyTextProps {
  paise: number;
  type?: "balance" | "cash" | "credit" | "payment" | "neutral";
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  className?: string;
  showDecimalsIfZero?: boolean;
}

export function MoneyText({
  paise,
  type = "neutral",
  size = "md",
  className = "",
  showDecimalsIfZero = false,
}: MoneyTextProps) {
  let colorClass = "text-slate-900";

  if (type === "balance") {
    if (paise > 0) {
      colorClass = "text-red-600"; // Customer owes mill
    } else if (paise < 0) {
      colorClass = "text-blue-600"; // Advance payment
    } else {
      colorClass = "text-slate-700"; // Settled / Nil
    }
  } else if (type === "cash") {
    colorClass = "text-emerald-700";
  } else if (type === "credit") {
    colorClass = "text-amber-700";
  } else if (type === "payment") {
    colorClass = "text-blue-700";
  }

  let sizeClass = "text-base font-bold";
  if (size === "xs") sizeClass = "text-xs font-semibold";
  if (size === "sm") sizeClass = "text-sm font-semibold";
  if (size === "md") sizeClass = "text-base font-bold";
  if (size === "lg") sizeClass = "text-lg font-bold";
  if (size === "xl") sizeClass = "text-xl font-extrabold";
  if (size === "2xl") sizeClass = "text-2xl font-black";
  if (size === "3xl") sizeClass = "text-3xl font-black";

  const formatted = formatINR(paise, { showDecimalsIfZero });
  const hasCustomColor = className.includes("text-");
  const finalColorClass = hasCustomColor ? "" : colorClass;
  const accessibleText = `${paise < 0 ? "minus " : ""}${paiseToRupees(Math.abs(paise))} rupees`;

  return (
    <Text
      accessibilityLabel={accessibleText}
      className={`${sizeClass} ${finalColorClass} ${className}`.trim()}
    >
      {formatted}
    </Text>
  );
}
