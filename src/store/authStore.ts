import { create } from "zustand";
import { securityService } from "@/services/security";

interface AuthState {
  isInitializing: boolean;
  isLocked: boolean;
  isPinSet: boolean;
  hasBiometrics: boolean;
  failedAttempts: number;
  lockoutUntil: number | null;
  checkAuthStatus: () => Promise<void>;
  verifyPin: (pin: string) => Promise<{ success: boolean; lockedOut?: boolean; remainingSeconds?: number }>;
  unlockWithBiometrics: () => Promise<boolean>;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  lock: () => void;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export const useAuthStore = create<AuthState>((set, get) => ({
  isInitializing: true,
  isLocked: false,
  isPinSet: false,
  hasBiometrics: false,
  failedAttempts: 0,
  lockoutUntil: null,

  checkAuthStatus: async () => {
    const hasPin = await securityService.isPinSet();
    const hasBio = await securityService.hasBiometricHardware();
    set({
      isPinSet: hasPin,
      hasBiometrics: hasBio,
      isLocked: hasPin,
      isInitializing: false,
    });
  },

  verifyPin: async (pin: string) => {
    const state = get();
    const now = Date.now();

    if (state.lockoutUntil && now < state.lockoutUntil) {
      const remainingSeconds = Math.ceil((state.lockoutUntil - now) / 1000);
      return { success: false, lockedOut: true, remainingSeconds };
    }

    const isValid = await securityService.verifyPin(pin);

    if (isValid) {
      set({ isLocked: false, failedAttempts: 0, lockoutUntil: null });
      return { success: true };
    }

    const nextAttempts = state.failedAttempts + 1;
    if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockoutEnd = now + LOCKOUT_SECONDS * 1000;
      set({ failedAttempts: nextAttempts, lockoutUntil: lockoutEnd });
      return { success: false, lockedOut: true, remainingSeconds: LOCKOUT_SECONDS };
    }

    set({ failedAttempts: nextAttempts });
    return { success: false, lockedOut: false };
  },

  unlockWithBiometrics: async () => {
    const success = await securityService.authenticateBiometrics();
    if (success) {
      set({ isLocked: false, failedAttempts: 0, lockoutUntil: null });
      return true;
    }
    return false;
  },

  setPin: async (pin: string) => {
    await securityService.setPin(pin);
    set({ isPinSet: true, isLocked: false, failedAttempts: 0, lockoutUntil: null });
  },

  removePin: async () => {
    await securityService.clearPin();
    set({ isPinSet: false, isLocked: false, failedAttempts: 0, lockoutUntil: null });
  },

  lock: () => {
    const state = get();
    if (state.isPinSet) {
      set({ isLocked: true });
    }
  },
}));
