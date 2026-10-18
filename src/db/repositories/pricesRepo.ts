import { generateUUID } from "@/utils/uuid";
import { getDb } from "../client";
import { nowISO } from "@/utils/dates";

export interface PriceRecord {
  id: string;
  product_id: string;
  price_paise: number;
  effective_from: string;
  created_at: string;
  synced_at: string | null;
}

export const pricesRepo = {
  /**
   * Adds a new price point to price_history.
   * Strictly enforces Non-negotiable Rule 2: Prices are NEVER edited, only added.
   */
  addPrice(productId: string, pricePaise: number, effectiveFrom?: string): PriceRecord {
    const db = getDb();
    const id = generateUUID();
    const now = nowISO();
    const record: PriceRecord = {
      id,
      product_id: productId,
      price_paise: Math.round(pricePaise),
      effective_from: effectiveFrom || now,
      created_at: now,
      synced_at: null,
    };

    db.runSync(
      `INSERT INTO price_history (id, product_id, price_paise, effective_from, created_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.product_id,
        record.price_paise,
        record.effective_from,
        record.created_at,
        record.synced_at,
      ]
    );

    return record;
  },

  /**
   * Retrieves the effective price for a product as of a specific date (defaults to current time).
   */
  getCurrentPrice(productId: string, atDate?: string): number | null {
    const db = getDb();
    const targetDate = atDate || nowISO();
    const row = db.getFirstSync<{ price_paise: number }>(
      `SELECT price_paise FROM price_history
       WHERE product_id = ? AND effective_from <= ?
       ORDER BY effective_from DESC, created_at DESC LIMIT 1`,
      [productId, targetDate]
    );

    return row ? row.price_paise : null;
  },

  /**
   * Returns complete immutable history of prices for a product, latest first.
   */
  getHistory(productId: string): PriceRecord[] {
    const db = getDb();
    return db.getAllSync<PriceRecord>(
      `SELECT * FROM price_history
       WHERE product_id = ?
       ORDER BY effective_from DESC, created_at DESC`,
      [productId]
    );
  },
};
