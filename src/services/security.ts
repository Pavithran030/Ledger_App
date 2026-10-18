import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import * as Crypto from "expo-crypto";

const PIN_KEY = "cattle_feed_pin_hash";
const BIOMETRIC_KEY = "cattle_feed_biometrics_enabled";

async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

export const securityService = {
  async setPin(pin: string): Promise<void> {
    const hashed = await hashPin(pin);
    await SecureStore.setItemAsync(PIN_KEY, hashed);
  },

  async verifyPin(pin: string): Promise<boolean> {
    const storedHash = await SecureStore.getItemAsync(PIN_KEY);
    if (!storedHash) return true; // No PIN set
    const enteredHash = await hashPin(pin);
    return storedHash === enteredHash;
  },

  async isPinSet(): Promise<boolean> {
    const storedHash = await SecureStore.getItemAsync(PIN_KEY);
    return storedHash !== null && storedHash.length > 0;
  },

  async clearPin(): Promise<void> {
    await SecureStore.deleteItemAsync(PIN_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  },

  async hasBiometricHardware(): Promise<boolean> {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  },

  async authenticateBiometrics(promptMessage = "Unlock Cattle Feed Ledger"): Promise<boolean> {
    const isAvailable = await this.hasBiometricHardware();
    if (!isAvailable) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: "Use PIN",
      disableDeviceFallback: false,
    });

    return result.success;
  },
};
