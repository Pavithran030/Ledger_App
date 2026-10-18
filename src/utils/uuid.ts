import * as Crypto from "expo-crypto";

/**
 * Generates a standard UUID v4 string.
 * Uses native expo-crypto with an RFC4122 compliant fallback for testing environments.
 */
export function generateUUID(): string {
  try {
    if (Crypto && typeof Crypto.randomUUID === "function") {
      const id = Crypto.randomUUID();
      if (id && typeof id === "string" && id.length > 0) {
        return id;
      }
    }
  } catch {
    // Fall back to pure generator
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
