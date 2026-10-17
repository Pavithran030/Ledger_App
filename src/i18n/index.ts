import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import en from "./en.json";
import ta from "./ta.json";

const resources = {
  en: { translation: en },
  ta: { translation: ta },
};

// Check device locale for default language
const locales = Localization.getLocales();
const deviceLanguage = locales[0]?.languageCode === "ta" ? "ta" : "en";

i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  resources,
  lng: deviceLanguage,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
