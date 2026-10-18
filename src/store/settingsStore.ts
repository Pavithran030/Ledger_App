import { create } from "zustand";
import { settingsRepo } from "@/db/repositories/settingsRepo";
import i18n from "i18next";

const DEFAULT_MILL_NAME = "Cattle Feed Mill";

interface SettingsState {
  millName: string;
  millPhone: string;
  language: "en" | "ta";
  loadSettings: () => void;
  setMillProfile: (name: string, phone: string) => void;
  setLanguage: (lang: "en" | "ta") => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  millName: DEFAULT_MILL_NAME,
  millPhone: "",
  language: "en",

  loadSettings: () => {
    const name = settingsRepo.get("mill_name", DEFAULT_MILL_NAME);
    const phone = settingsRepo.get("mill_phone", "");
    const lang = (settingsRepo.get("language", "en") as "en" | "ta") || "en";
    set({ millName: name, millPhone: phone, language: lang });
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  },

  setMillProfile: (name: string, phone: string) => {
    settingsRepo.set("mill_name", name.trim() || DEFAULT_MILL_NAME);
    settingsRepo.set("mill_phone", phone.trim());
    set({ millName: name.trim() || DEFAULT_MILL_NAME, millPhone: phone.trim() });
  },

  setLanguage: (lang: "en" | "ta") => {
    settingsRepo.set("language", lang);
    set({ language: lang });
    i18n.changeLanguage(lang);
  },
}));
