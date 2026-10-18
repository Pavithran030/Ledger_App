// Standardizes an Indian mobile number into the 12-digit form "91XXXXXXXXXX".
// Returns null when the input cannot be parsed as a valid 10-digit mobile number.
export function sanitizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }
  return null;
}
