/**
 * Contacts Import Screen
 *
 * Lets the user pick contacts from their phone book and register them as
 * customers in one batch operation.
 *
 * Performance notes:
 *  - All FlatList item styles use StyleSheet (NOT NativeWind className).
 *    NativeWind dynamic class strings inside VirtualizedList items can inject
 *    unresolved string nodes, causing the "Text strings must be rendered
 *    within a <Text> component" crash.
 *  - getItemLayout is provided so FlatList never has to measure items.
 *  - ContactRow is React.memo-wrapped and receives only primitive / stable props.
 */
import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  ListRenderItemInfo,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { SearchBar } from "@/components/SearchBar";
import { BigButton } from "@/components/BigButton";
import {
  requestContactsPermission,
  fetchPhoneContacts,
  importContacts,
  PhoneContact,
} from "@/services/contacts";

// ─── Constants ────────────────────────────────────────────────────────────────
const { width } = Dimensions.get("window");
const ITEM_HEIGHT = 64; // fixed row height — required for getItemLayout
type Filter = "all" | "new" | "imported";

// ─── Contact Row ─────────────────────────────────────────────────────────────
// All styles are from StyleSheet — no NativeWind className here.

interface ContactRowProps {
  name: string;
  phone: string;
  initial: string;
  selected: boolean;
  alreadyImported: boolean;
  contactId: string;
  onToggle: (id: string) => void;
  alreadyAddedLabel: string;
}

const ContactRow = React.memo(function ContactRow({
  name,
  phone,
  initial,
  selected,
  alreadyImported,
  contactId,
  onToggle,
  alreadyAddedLabel,
}: ContactRowProps) {
  const isDisabled = alreadyImported;

  const handlePress = useCallback(() => {
    if (!isDisabled) onToggle(contactId);
  }, [isDisabled, onToggle, contactId]);

  // Checkbox colours
  const checkboxBg = isDisabled
    ? "#f1f5f9"
    : selected
    ? "#16a34a"
    : "#ffffff";
  const checkboxBorder = isDisabled
    ? "#cbd5e1"
    : selected
    ? "#16a34a"
    : "#cbd5e1";

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.6}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: isDisabled }}
      accessibilityLabel={`${name} ${phone}`}
      style={[rowStyles.row, isDisabled && rowStyles.rowDisabled]}
    >
      {/* Checkbox circle */}
      <View
        style={[
          rowStyles.checkbox,
          { backgroundColor: checkboxBg, borderColor: checkboxBorder },
        ]}
      >
        {(selected || isDisabled) ? (
          <Ionicons
            name="checkmark"
            size={13}
            color={isDisabled ? "#94a3b8" : "#ffffff"}
          />
        ) : null}
      </View>

      {/* Avatar */}
      <View style={rowStyles.avatar}>
        <Text style={rowStyles.avatarText}>{initial}</Text>
      </View>

      {/* Name + phone */}
      <View style={rowStyles.info}>
        <Text style={rowStyles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={rowStyles.phone} numberOfLines={1}>
          {phone}
        </Text>
      </View>

      {/* Badge */}
      {isDisabled ? (
        <View style={rowStyles.badge}>
          <Text style={rowStyles.badgeText}>{alreadyAddedLabel}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

const rowStyles = StyleSheet.create({
  row: {
    height: ITEM_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  rowDisabled: {
    opacity: 0.55,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
  phone: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 1,
  },
  badge: {
    backgroundColor: "#d1fae5",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#065f46",
  },
});

// ─── Filter Pill ─────────────────────────────────────────────────────────────

interface PillProps {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}

function FilterPill({ label, count, active, onPress }: PillProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[pillStyles.pill, active ? pillStyles.pillActive : pillStyles.pillInactive]}
    >
      <Text style={[pillStyles.pillText, active ? pillStyles.pillTextActive : pillStyles.pillTextInactive]}>
        {label}
      </Text>
      {count > 0 ? (
        <View style={[pillStyles.badge, active ? pillStyles.badgeActive : pillStyles.badgeInactive]}>
          <Text style={[pillStyles.badgeText, active ? pillStyles.badgeTextActive : pillStyles.badgeTextInactive]}>
            {count}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    minHeight: 36,
  },
  pillActive: { backgroundColor: "#2563eb" },
  pillInactive: { backgroundColor: "#f1f5f9" },
  pillText: { fontSize: 13, fontWeight: "600" },
  pillTextActive: { color: "#ffffff" },
  pillTextInactive: { color: "#475569" },
  badge: {
    borderRadius: 99,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 5,
  },
  badgeActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  badgeInactive: { backgroundColor: "#cbd5e1" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  badgeTextActive: { color: "#ffffff" },
  badgeTextInactive: { color: "#475569" },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ContactsImportScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "importing">("idle");
  const [contacts, setContacts] = useState<PhoneContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("new");

  // Stable label string to avoid re-creating ContactRow on every render
  const alreadyAddedLabel = t("contacts.alreadyAdded");

  // ── Permission & load ──────────────────────────────────────────────────────
  const handleLoadContacts = useCallback(async () => {
    setPhase("loading");
    let granted = false;
    try {
      granted = await requestContactsPermission();
    } catch {
      granted = false;
    }

    if (!granted) {
      setPhase("idle");
      Alert.alert(
        t("contacts.permissionDeniedTitle"),
        t("contacts.permissionDeniedMsg"),
        [{ text: t("common.ok") }]
      );
      return;
    }

    try {
      const list = await fetchPhoneContacts();
      setContacts(list);
      // Pre-select all new contacts
      const newIds = new Set(
        list.filter((c) => !c.alreadyImported).map((c) => c.contactId)
      );
      setSelected(newIds);
      setPhase("ready");
    } catch {
      setPhase("idle");
      Alert.alert(t("common.error"), t("contacts.loadError"), [
        { text: t("common.ok") },
      ]);
    }
  }, [t]);

  // ── Filter + search ────────────────────────────────────────────────────────
  const displayed = useMemo<PhoneContact[]>(() => {
    let list = contacts;
    if (filter === "new") list = list.filter((c) => !c.alreadyImported);
    else if (filter === "imported") list = list.filter((c) => c.alreadyImported);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.phone.includes(q)
      );
    }
    return list;
  }, [contacts, filter, searchQuery]);

  // ── Counts ─────────────────────────────────────────────────────────────────
  const newCount = useMemo(
    () => contacts.filter((c) => !c.alreadyImported).length,
    [contacts]
  );
  const importedCount = useMemo(
    () => contacts.filter((c) => c.alreadyImported).length,
    [contacts]
  );
  const selectedNewCount = useMemo(
    () =>
      [...selected].filter((id) => {
        const c = contacts.find((x) => x.contactId === id);
        return c && !c.alreadyImported;
      }).length,
    [selected, contacts]
  );

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allVisibleNewSelected = useMemo(
    () =>
      displayed
        .filter((c) => !c.alreadyImported)
        .every((c) => selected.has(c.contactId)),
    [displayed, selected]
  );

  const handleSelectToggleAll = useCallback(() => {
    if (allVisibleNewSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        displayed.forEach((c) => next.delete(c.contactId));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        displayed
          .filter((c) => !c.alreadyImported)
          .forEach((c) => next.add(c.contactId));
        return next;
      });
    }
  }, [allVisibleNewSelected, displayed]);

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImport = useCallback(() => {
    const toImport = contacts.filter(
      (c) => selected.has(c.contactId) && !c.alreadyImported
    );
    if (toImport.length === 0) {
      Alert.alert(t("contacts.noneSelectedTitle"), t("contacts.noneSelectedMsg"));
      return;
    }

    Alert.alert(
      t("contacts.importConfirmTitle"),
      t("contacts.importConfirmMsg", { count: toImport.length }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("contacts.importNow"),
          onPress: () => {
            setPhase("importing");
            try {
              const result = importContacts(toImport);
              // Refresh list
              handleLoadContacts().then(() => {
                const msg =
                  result.errors.length > 0
                    ? t("contacts.importPartial", {
                        imported: result.imported,
                        errors: result.errors.length,
                      })
                    : t("contacts.importSuccess", { count: result.imported });
                Alert.alert(t("common.success"), msg, [{ text: t("common.ok") }]);
              });
            } catch {
              setPhase("ready");
              Alert.alert(t("common.error"), t("contacts.importError"), [
                { text: t("common.ok") },
              ]);
            }
          },
        },
      ]
    );
  }, [contacts, selected, t, handleLoadContacts]);

  // ── FlatList helpers ───────────────────────────────────────────────────────
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const keyExtractor = useCallback(
    (item: PhoneContact) => item.contactId,
    []
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PhoneContact>) => (
      <ContactRow
        contactId={item.contactId}
        name={item.name}
        phone={item.phone}
        initial={item.name.charAt(0).toUpperCase()}
        selected={selected.has(item.contactId)}
        alreadyImported={item.alreadyImported}
        onToggle={toggleOne}
        alreadyAddedLabel={alreadyAddedLabel}
      />
    ),
    [selected, toggleOne, alreadyAddedLabel]
  );

  const listEmpty = useMemo(
    () => (
      <View style={screenStyles.emptyContainer}>
        <Ionicons name="search-outline" size={40} color="#94a3b8" />
        <Text style={screenStyles.emptyText}>
          {searchQuery
            ? t("contacts.noResultsSearch")
            : t("contacts.noNewContacts")}
        </Text>
      </View>
    ),
    [searchQuery, t]
  );

  // ── IDLE (permission prompt) ───────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <SafeAreaView style={screenStyles.flex} edges={["bottom"]}>
        <View style={screenStyles.idleCenter}>
          <View style={screenStyles.idleIconWrap}>
            <Ionicons name="people" size={48} color="#2563eb" />
          </View>
          <Text style={screenStyles.idleTitle}>{t("contacts.importTitle")}</Text>
          <Text style={screenStyles.idleDesc}>{t("contacts.importDesc")}</Text>
          <View style={screenStyles.fullWidth}>
            <BigButton
              title={t("contacts.openContacts")}
              onPress={handleLoadContacts}
              icon="people-outline"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <SafeAreaView style={[screenStyles.flex, screenStyles.centerAll]} edges={["bottom"]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={screenStyles.loadingText}>{t("contacts.loading")}</Text>
      </SafeAreaView>
    );
  }

  // ── READY / IMPORTING ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={screenStyles.flex} edges={["bottom"]}>
      {/* Search */}
      <View style={screenStyles.searchBar}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("contacts.searchPlaceholder")}
        />
      </View>

      {/* Filter pills row */}
      <View style={screenStyles.filterRow}>
        <View style={screenStyles.pillsRow}>
          <FilterPill
            label={t("common.all")}
            count={contacts.length}
            active={filter === "all"}
            onPress={() => setFilter("all")}
          />
          <FilterPill
            label={t("contacts.filterNew")}
            count={newCount}
            active={filter === "new"}
            onPress={() => setFilter("new")}
          />
          <FilterPill
            label={t("contacts.filterImported")}
            count={importedCount}
            active={filter === "imported"}
            onPress={() => setFilter("imported")}
          />
        </View>
        <TouchableOpacity
          onPress={handleSelectToggleAll}
          style={screenStyles.selectAllBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={screenStyles.selectAllText}>
            {allVisibleNewSelected
              ? t("contacts.deselectAll")
              : t("contacts.selectAll")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contact list — all item styles via StyleSheet, never NativeWind */}
      <FlatList<PhoneContact>
        data={displayed}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews={true}
        style={screenStyles.flex}
        ListEmptyComponent={listEmpty}
      />

      {/* Bottom action bar */}
      <View style={screenStyles.bottomBar}>
        <Text style={screenStyles.countText}>
          {t("contacts.selectedCount", { count: selectedNewCount })}
        </Text>
        <BigButton
          title={
            phase === "importing"
              ? t("contacts.importing")
              : t("contacts.importSelected", { count: selectedNewCount })
          }
          onPress={handleImport}
          loading={phase === "importing"}
          disabled={selectedNewCount === 0 || phase === "importing"}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Screen-level styles ──────────────────────────────────────────────────────
const screenStyles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#ffffff" },
  centerAll: { alignItems: "center", justifyContent: "center" },
  // Idle
  idleCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  idleIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  idleTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 8,
  },
  idleDesc: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  fullWidth: { width: width - 64 },
  // Loading
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: "#64748b",
  },
  // Search
  searchBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  // Filter row
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  pillsRow: { flexDirection: "row" },
  selectAllBtn: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563eb",
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
  },
  // Bottom bar
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  countText: {
    textAlign: "center",
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
  },
});
