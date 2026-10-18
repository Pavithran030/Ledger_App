/**
 * Contacts Service
 *
 * Bridges expo-contacts with the customer repository.
 * - Requests permission (one-shot, non-blocking)
 * - Fetches all phone contacts and normalises Indian mobile numbers
 * - Detects which contacts are already registered customers (by phone)
 * - Bulk-imports selected contacts in a single synchronous loop
 *   (each individual insert is atomic via customersRepo.create)
 */
import * as Contacts from "expo-contacts/legacy";
import { customersRepo } from "@/db/repositories/customersRepo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhoneContact {
  /** expo-contacts ID – not stored in our DB */
  contactId: string;
  name: string;
  /** Normalised to 10-digit Indian mobile (no country code) or raw value */
  phone: string;
  /** Raw display value from the contact book */
  rawPhone: string;
  /** true if a customer with the same normalised phone already exists */
  alreadyImported: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalises an Indian phone number to exactly 10 digits.
 * Accepts:
 *   +91 XXXXX XXXXX  →  XXXXXXXXXX
 *   0XXXXXXXXXX      →  XXXXXXXXXX
 *   91XXXXXXXXXX     →  XXXXXXXXXX
 *   XXXXXXXXXX       →  XXXXXXXXXX (passthrough)
 * Returns null if the stripped result is not exactly 10 digits.
 */
export function normalizeIndianPhone(raw: string): string | null {
  // Strip everything that is not a digit
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) return digits;

  // +91 prefix → 12 digits
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }

  // 0 prefix → 11 digits
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }

  return null;
}

/**
 * Build a Set of normalised phones already in the customer table.
 * Used to quickly flag duplicates without a DB query per contact.
 */
function buildExistingPhoneSet(): Set<string> {
  const all = customersRepo.list("all");
  const set = new Set<string>();
  for (const c of all) {
    if (c.phone) {
      const norm = normalizeIndianPhone(c.phone);
      if (norm) set.add(norm);
      // Also store the raw value in case it was saved without normalisation
      set.add(c.phone.replace(/\D/g, ""));
    }
  }
  return set;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Requests contacts permission.
 * Returns true if granted, false otherwise (do not show UI if false).
 */
export async function requestContactsPermission(): Promise<boolean> {
  const { status } = await Contacts.requestPermissionsAsync();
  return status === "granted";
}

/**
 * Fetches all device contacts that have at least one phone number.
 * Returns them as PhoneContact[], enriched with `alreadyImported` flag.
 * Sorted: new contacts first, then already-imported, all alphabetically.
 */
export async function fetchPhoneContacts(): Promise<PhoneContact[]> {
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
    sort: Contacts.SortTypes.FirstName,
  });

  const existingPhones = buildExistingPhoneSet();
  const seen = new Set<string>(); // deduplicate across multiple numbers on same contact
  const results: PhoneContact[] = [];

  for (const contact of data) {
    if (!contact.phoneNumbers?.length || !contact.name) continue;

    for (const phoneEntry of contact.phoneNumbers) {
      const raw = phoneEntry.number ?? "";
      if (!raw) continue;

      const norm = normalizeIndianPhone(raw);
      const key = norm ?? raw.replace(/\D/g, "");

      // Skip blank or very short numbers (landlines < 6 digits)
      if (key.length < 6) continue;
      // Skip if we've already added this number from another contact
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        contactId: contact.id ?? `${contact.name}-${key}`,
        name: contact.name.trim(),
        phone: norm ?? raw.trim(),
        rawPhone: raw.trim(),
        alreadyImported: existingPhones.has(key),
      });
    }
  }

  // Sort: new contacts first, then already-imported; each group alphabetical
  results.sort((a, b) => {
    if (a.alreadyImported !== b.alreadyImported) {
      return a.alreadyImported ? 1 : -1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return results;
}

/**
 * Imports a selection of PhoneContacts into the customers table.
 * Skips any that are already imported (safety guard).
 * Returns a summary of the operation.
 */
export function importContacts(contacts: PhoneContact[]): ImportResult {
  const existingPhones = buildExistingPhoneSet();
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (const c of contacts) {
    const key = normalizeIndianPhone(c.phone) ?? c.phone.replace(/\D/g, "");

    if (existingPhones.has(key)) {
      result.skipped++;
      continue;
    }

    try {
      customersRepo.create({
        name: c.name,
        phone: c.phone, // store the normalised 10-digit number
      });
      existingPhones.add(key); // prevent double-insert within same batch
      result.imported++;
    } catch (err) {
      result.errors.push(`${c.name}: ${String(err)}`);
    }
  }

  return result;
}
