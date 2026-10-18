import { getDb } from "@/db/client";
import { settingsRepo } from "@/db/repositories/settingsRepo";
import { nowISO, getTodayDateString } from "@/utils/dates";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { parseISO, differenceInDays } from "date-fns";

export interface DatabaseBackup {
  version: number;
  exported_at: string;
  app: string;
  tables: {
    customers: any[];
    products: any[];
    price_history: any[];
    bills: any[];
    bill_items: any[];
    payments: any[];
    stock_moves: any[];
    settings: any[];
  };
}

export const backupService = {
  /**
   * Serializes the entire SQLite database into a validated JSON backup object.
   */
  exportDatabaseToJson(): DatabaseBackup {
    const db = getDb();

    return {
      version: 1,
      exported_at: nowISO(),
      app: "cattle-feed-credit-ledger",
      tables: {
        customers: db.getAllSync("SELECT * FROM customers"),
        products: db.getAllSync("SELECT * FROM products"),
        price_history: db.getAllSync("SELECT * FROM price_history"),
        bills: db.getAllSync("SELECT * FROM bills"),
        bill_items: db.getAllSync("SELECT * FROM bill_items"),
        payments: db.getAllSync("SELECT * FROM payments"),
        stock_moves: db.getAllSync("SELECT * FROM stock_moves"),
        settings: db.getAllSync("SELECT * FROM settings"),
      },
    };
  },

  /**
   * Generates a backup JSON file and prompts native share sheet (WhatsApp, Drive, Email, etc.).
   */
  async shareDatabaseBackup(): Promise<void> {
    const backup = this.exportDatabaseToJson();
    const jsonStr = JSON.stringify(backup, null, 2);
    const filename = `cattle_feed_backup_${getTodayDateString()}.json`;

    const fileUri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, jsonStr, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Record last backup date in settings
    settingsRepo.set("last_backup_at", nowISO());

    await Sharing.shareAsync(fileUri, {
      mimeType: "application/json",
      UTI: "public.json",
    });
  },

  /**
   * Validates and restores database from a JSON backup.
   * Runs inside an atomic transaction.
   */
  restoreDatabaseFromJson(jsonString: string): { success: boolean; error?: string } {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      return { success: false, error: "Invalid JSON format" };
    }

    if (!parsed || !parsed.tables || parsed.app !== "cattle-feed-credit-ledger") {
      return { success: false, error: "Unrecognized backup file or missing tables" };
    }

    // Verify all required table arrays exist
    const requiredTables = ["customers", "products", "price_history", "bills", "bill_items", "payments", "stock_moves"];
    for (const t of requiredTables) {
      if (!Array.isArray(parsed.tables[t])) {
        return { success: false, error: `Corrupt backup: missing table ${t}` };
      }
    }

    const db = getDb();
    try {
      db.withTransactionSync(() => {
        // Clear existing tables
        db.execSync(`
          DELETE FROM bill_items;
          DELETE FROM stock_moves;
          DELETE FROM payments;
          DELETE FROM bills;
          DELETE FROM price_history;
          DELETE FROM products;
          DELETE FROM customers;
        `);

        // Insert customers
        for (const c of parsed.tables.customers || []) {
          db.runSync(
            `INSERT INTO customers (id, name, phone, village, credit_limit_paise, notes, status, created_at, updated_at, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.id, c.name, c.phone, c.village, c.credit_limit_paise, c.notes, c.status, c.created_at, c.updated_at, c.synced_at]
          );
        }

        // Insert products
        for (const p of parsed.tables.products || []) {
          db.runSync(
            `INSERT INTO products (id, name, name_ta, unit, stock_qty, low_stock_alert, status, created_at, updated_at, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.id, p.name, p.name_ta, p.unit, p.stock_qty, p.low_stock_alert, p.status, p.created_at, p.updated_at, p.synced_at]
          );
        }

        // Insert price history
        for (const ph of parsed.tables.price_history || []) {
          db.runSync(
            `INSERT INTO price_history (id, product_id, price_paise, effective_from, created_at, synced_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [ph.id, ph.product_id, ph.price_paise, ph.effective_from, ph.created_at, ph.synced_at]
          );
        }

        // Insert bills
        for (const b of parsed.tables.bills || []) {
          db.runSync(
            `INSERT INTO bills (id, bill_no, customer_id, type, bill_date, due_date, total_paise, note, status, created_at, updated_at, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [b.id, b.bill_no, b.customer_id, b.type, b.bill_date, b.due_date, b.total_paise, b.note, b.status, b.created_at, b.updated_at, b.synced_at]
          );
        }

        // Insert bill items
        for (const bi of parsed.tables.bill_items || []) {
          db.runSync(
            `INSERT INTO bill_items (id, bill_id, product_id, qty, price_paise, amount_paise, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [bi.id, bi.bill_id, bi.product_id, bi.qty, bi.price_paise, bi.amount_paise, bi.synced_at]
          );
        }

        // Insert payments
        for (const pay of parsed.tables.payments || []) {
          db.runSync(
            `INSERT INTO payments (id, customer_id, amount_paise, pay_date, mode, note, status, created_at, updated_at, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pay.id, pay.customer_id, pay.amount_paise, pay.pay_date, pay.mode, pay.note, pay.status, pay.created_at, pay.updated_at, pay.synced_at]
          );
        }

        // Insert stock moves
        for (const sm of parsed.tables.stock_moves || []) {
          db.runSync(
            `INSERT INTO stock_moves (id, product_id, qty_change, reason, ref_id, created_at, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sm.id, sm.product_id, sm.qty_change, sm.reason, sm.ref_id, sm.created_at, sm.synced_at]
          );
        }

        // Restore settings if present
        if (Array.isArray(parsed.tables.settings)) {
          for (const s of parsed.tables.settings) {
            if (s.key) {
              db.runSync(
                `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
                [s.key, s.value ?? ""]
              );
            }
          }
        }
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to restore database tables" };
    }
  },

  isBackupOverdue(): boolean {
    const lastBackup = settingsRepo.get("last_backup_at", "");
    if (!lastBackup) return true; // Never backed up
    try {
      const days = differenceInDays(new Date(), parseISO(lastBackup));
      return days >= 7;
    } catch {
      return true;
    }
  },
};
