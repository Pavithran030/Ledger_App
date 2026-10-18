/**
 * Money utilities for Cattle Feed Ledger.
 * Non-negotiable rule: Money is ALWAYS stored as integer paise (1 INR = 100 paise).
 * No floating point math for money calculations.
 */

/**
 * Converts a rupee amount (can be decimal from UI input like 1200.50) into integer paise.
 */
export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === "string") {
    const cleaned = rupees.trim().replace(/,/g, "");
    if (!cleaned || isNaN(Number(cleaned))) {
      return 0;
    }
    const num = parseFloat(cleaned);
    return Math.round(num * 100);
  }
  return Math.round(rupees * 100);
}

/**
 * Converts integer paise to rupees for UI display or numerical calculations.
 */
export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Formats integer paise into Indian Rupee format with Indian number grouping (e.g., ₹1,25,000).
 * Examples:
 *  12500000 paise -> "₹1,25,000"
 *  12500050 paise -> "₹1,25,000.50"
 *  -50000 paise   -> "-₹500"
 */
export function formatINR(paise: number, options: { showDecimalsIfZero?: boolean; includeSymbol?: boolean } = {}): string {
  const { showDecimalsIfZero = false, includeSymbol = true } = options;
  const isNegative = paise < 0;
  const absPaise = Math.abs(Math.round(paise));
  const wholeRupees = Math.floor(absPaise / 100);
  const remainderPaise = absPaise % 100;

  // Format integer part using Indian numbering system
  const strWhole = wholeRupees.toString();
  let lastThree = strWhole.substring(strWhole.length - 3);
  const otherNumbers = strWhole.substring(0, strWhole.length - 3);
  if (otherNumbers !== "") {
    lastThree = "," + lastThree;
  }
  const formattedWhole = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;

  let decimalPart = "";
  if (remainderPaise > 0 || showDecimalsIfZero) {
    decimalPart = "." + remainderPaise.toString().padStart(2, "0");
  }

  const symbol = includeSymbol ? "₹" : "";
  const sign = isNegative ? "-" : "";

  return `${sign}${symbol}${formattedWhole}${decimalPart}`;
}

/**
 * Multiplies quantity by price in paise, rounding to the nearest integer paise.
 */
export function calculateLineAmountPaise(qty: number, pricePaise: number): number {
  return Math.round(qty * pricePaise);
}
