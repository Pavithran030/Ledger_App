import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import { BigButton } from "@/components/BigButton";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { backupService } from "@/services/backup";
import { syncService } from "@/services/sync";
import { formatDateTime } from "@/utils/dates";
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
import { useSyncStore } from "@/store/syncStore";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const storeMillName = useSettingsStore((state) => state.millName);
  const storeMillPhone = useSettingsStore((state) => state.millPhone);
  const storeLanguage = useSettingsStore((state) => state.language);
  const setMillProfile = useSettingsStore((state) => state.setMillProfile);
  const setLanguageStore = useSettingsStore((state) => state.setLanguage);

  const isPinSet = useAuthStore((state) => state.isPinSet);
  const removePin = useAuthStore((state) => state.removePin);

  const isSyncing = useSyncStore((state) => state.isSyncing);
  const triggerSync = useSyncStore((state) => state.triggerSync);
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt);

  const [millName, setMillName] = useState(storeMillName);
  const [millPhone, setMillPhone] = useState(storeMillPhone);
  const [saving, setSaving] = useState(false);
  const [isBackupOverdue, setIsBackupOverdue] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  useEffect(() => {
    setMillName(storeMillName);
    setMillPhone(storeMillPhone);
    setIsBackupOverdue(backupService.isBackupOverdue());
  }, [storeMillName, storeMillPhone]);

  useEffect(() => {
    setLastSyncAt(syncService.getLastSyncTime());
  }, [lastSyncedAt]);

  const handleLanguageChange = (newLang: "en" | "ta") => {
    setLanguageStore(newLang);
  };

  const handleSave = () => {
    if (!millName.trim()) {
      Alert.alert(t("common.warning"), t("settings.millNameRequired"));
      return;
    }

    setSaving(true);
    try {
      setMillProfile(millName, millPhone);
      Alert.alert(t("common.success"), t("settings.profileSaved"));
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || t("settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleExportBackup = async () => {
    setExportingBackup(true);
    try {
      await backupService.shareDatabaseBackup();
      setIsBackupOverdue(false);
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || t("settings.backupFailed"));
    } finally {
      setExportingBackup(false);
    }
  };

  const handleSyncNow = async () => {
    const ok = await triggerSync();
    if (ok) {
      Alert.alert(t("common.success"), t("settings.syncSuccess"));
    } else {
      const msg = useSyncStore.getState().syncError || t("settings.syncFailed");
      Alert.alert(t("common.error"), msg);
    }
  };

  const handleRemovePin = () => {
    Alert.alert(t("settings.removePinTitle"), t("settings.removePinConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await removePin();
          Alert.alert(t("common.success"), t("settings.pinRemoved"));
        },
      },
    ]);
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50 p-4"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* 7-day Backup Warning Banner */}
      {isBackupOverdue && (
        <View className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <View className="flex-row items-center">
            <Ionicons name="time" size={20} color="#b45309" />
            <Text className="ml-2 font-bold text-amber-900">
              {t("settings.backupReminder")}
            </Text>
          </View>
          <Text className="mt-1 text-xs text-amber-700">
            {t("settings.backupWarning")}
          </Text>
        </View>
      )}

      {/* Mill Profile */}
      <View className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <Text className="mb-4 text-lg font-bold text-slate-900">{t("settings.title")}</Text>

        <View className="mb-4">
          <Text className="mb-1 text-sm font-semibold text-slate-700">
            {t("settings.millName")} *
          </Text>
          <TextInput
            value={millName}
            onChangeText={setMillName}
            placeholder={t("settings.millNamePlaceholder")}
            placeholderTextColor="#94a3b8"
            className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-900"
          />
          <Text className="mt-1 text-xs text-slate-400">
            {t("settings.millNameHint")}
          </Text>
        </View>

        <View className="mb-2">
          <Text className="mb-1 text-sm font-semibold text-slate-700">
            {t("settings.millPhone")}
          </Text>
          <TextInput
            value={millPhone}
            onChangeText={setMillPhone}
            placeholder="e.g. 9876543210"
            placeholderTextColor="#94a3b8"
            keyboardType="phone-pad"
            className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-900"
          />
        </View>
      </View>

      {/* Language Selector */}
      <View className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <Text className="mb-1 text-lg font-bold text-slate-900">
          {t("settings.language")}
        </Text>
        <Text className="mb-4 text-xs text-slate-500">
          {t("settings.languageHint")}
        </Text>

        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => handleLanguageChange("en")}
            accessibilityRole="button"
            className={`min-h-[52px] flex-1 items-center justify-center rounded-2xl border ${
              storeLanguage === "en"
                ? "border-emerald-600 bg-emerald-50"
                : "border-slate-300 bg-white"
            }`}
          >
            <Text
              className={`text-base font-bold ${
                storeLanguage === "en" ? "text-emerald-700" : "text-slate-700"
              }`}
            >
              English
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleLanguageChange("ta")}
            accessibilityRole="button"
            className={`min-h-[52px] flex-1 items-center justify-center rounded-2xl border ${
              storeLanguage === "ta"
                ? "border-emerald-600 bg-emerald-50"
                : "border-slate-300 bg-white"
            }`}
          >
            <Text
              className={`text-base font-bold ${
                storeLanguage === "ta" ? "text-emerald-700" : "text-slate-700"
              }`}
            >
              தமிழ் (Tamil)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Security & Access */}
      <View className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <Text className="mb-3 text-lg font-bold text-slate-900">
          {t("settings.securityPrivacy")}
        </Text>

        <TouchableOpacity
          onPress={() => router.push({ pathname: "/(auth)/pin", params: { mode: "change" } })}
          accessibilityRole="button"
          className="min-h-[48px] flex-row items-center justify-between py-2"
        >
          <View className="flex-row items-center">
            <Ionicons name="lock-closed-outline" size={20} color="#334155" />
            <Text className="ml-3 text-base font-semibold text-slate-800">
              {isPinSet ? t("settings.changePin") : t("settings.setPin")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>

        {isPinSet && (
          <TouchableOpacity
            onPress={handleRemovePin}
            accessibilityRole="button"
            className="min-h-[48px] flex-row items-center justify-between py-2 border-t border-slate-100 mt-2"
          >
            <View className="flex-row items-center">
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text className="ml-3 text-base font-semibold text-red-600">
                {t("settings.removePinTitle")}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Backup & Export */}
      <View className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <Text className="mb-1 text-lg font-bold text-slate-900">{t("settings.backup")}</Text>
        <Text className="mb-4 text-xs text-slate-500">
          {t("settings.backupHint")}
        </Text>

        <BigButton
          title={t("settings.exportBackup")}
          onPress={handleExportBackup}
          loading={exportingBackup}
          variant="secondary"
          size="md"
        />
      </View>

      {/* Cloud Sync */}
      <View className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <Text className="mb-1 text-lg font-bold text-slate-900">{t("settings.sync")}</Text>
        <Text className="mb-3 text-xs text-slate-500">{t("settings.syncHint")}</Text>

        <View className="mb-3 flex-row items-center justify-between rounded-xl bg-slate-100 px-3 py-2.5">
          <Text className="text-xs font-semibold text-slate-500">
            {t("settings.lastSynced")}
          </Text>
          <Text className="text-xs font-bold text-slate-700">
            {lastSyncAt ? formatDateTime(lastSyncAt) : t("settings.syncNever")}
          </Text>
        </View>

        <BigButton
          title={isSyncing ? t("settings.syncing") : t("settings.syncNow")}
          onPress={handleSyncNow}
          loading={isSyncing}
          variant="secondary"
          size="md"
        />
      </View>

      {/* Save Profile Button */}
      <View className="mb-10">
        <BigButton
          title={t("settings.saveProfile")}
          onPress={handleSave}
          loading={saving}
          variant="primary"
        />
      </View>
    </ScrollView>
  );
}
