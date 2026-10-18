import { getDb } from "@/db/client";
import { settingsRepo } from "@/db/repositories/settingsRepo";
import { nowISO } from "@/utils/dates";

export interface SyncStatus {
  isConfigured: boolean;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  error?: string | null;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

interface SyncTable {
  name: string;
  /** Tables that have no updated_at column (append-only rows). */
  hasUpdatedAt: boolean;
}

// Push order matters: parent rows must reach Supabase before their children
// so foreign keys are satisfied.
const SYNC_TABLES: SyncTable[] = [
  { name: "customers", hasUpdatedAt: true },
  { name: "products", hasUpdatedAt: true },
  { name: "price_history", hasUpdatedAt: false },
  { name: "bills", hasUpdatedAt: true },
  { name: "payments", hasUpdatedAt: true },
  { name: "stock_moves", hasUpdatedAt: false },
  { name: "bill_items", hasUpdatedAt: false },
];

function unsyncedWhere(table: SyncTable): string {
  return table.hasUpdatedAt
    ? "synced_at IS NULL OR updated_at > synced_at"
    : "synced_at IS NULL";
}

/** Drop local-only bookkeeping columns before sending a row to the cloud. */
function toRemoteRow(row: Record<string, unknown>): Record<string, unknown> {
  const { synced_at, ...rest } = row;
  return rest;
}

/** Upsert a batch of rows into a Supabase table using the REST endpoint. */
async function upsertRows(table: string, rows: Record<string, unknown>[]): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      // merge-duplicates => UPSERT on the primary key (id).
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Supabase "${table}" push failed (${res.status}): ${detail}`);
  }
}

export const syncService = {
  isConfigured(): boolean {
    return Boolean(SUPABASE_URL && SUPABASE_KEY);
  },

  getLastSyncTime(): string | null {
    const val = settingsRepo.get("last_sync_at", "");
    return val || null;
  },

  /**
   * Push every locally changed row to Supabase.
   * Offline-first: it never blocks the UI, and a failure simply leaves rows
   * marked as unsynced so they are retried next time.
   */
  async syncNow(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: "Cloud sync is optional. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable.",
      };
    }

    try {
      const db = getDb();
      const now = nowISO();
      let pushed = 0;

      for (const table of SYNC_TABLES) {
        const where = unsyncedWhere(table);
        const rows = db.getAllSync<Record<string, unknown>>(
          `SELECT * FROM ${table.name} WHERE ${where}`
        );
        if (rows.length === 0) continue;

        await upsertRows(table.name, rows.map(toRemoteRow));

        // Only mark as synced AFTER the cloud acknowledged the write.
        db.runSync(`UPDATE ${table.name} SET synced_at = ? WHERE ${where}`, [now]);
        pushed += rows.length;
      }

      settingsRepo.set("last_sync_at", now);

      return {
        success: true,
        message:
          pushed > 0
            ? `Synced ${pushed} record(s) to the cloud.`
            : "Everything is already up to date.",
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || "Sync failed. App will continue functioning offline.",
      };
    }
  },
};
