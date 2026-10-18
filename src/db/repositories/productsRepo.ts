import { generateUUID } from "@/utils/uuid";
import { getDb } from "../client";
import { nowISO } from "@/utils/dates";

export type ProductUnit = "bag" | "kg" | "litre" | "packet";

export interface Product {
  id: string;
  name: string;
  name_ta: string | null;
  unit: ProductUnit;
  stock_qty: number;
  low_stock_alert: number;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface ProductWithPrice extends Product {
  current_price_paise: number | null;
}

export interface CreateProductInput {
  name: string;
  name_ta?: string | null;
  unit?: ProductUnit;
  opening_stock?: number;
  low_stock_alert?: number;
}

export interface UpdateProductInput {
  name?: string;
  name_ta?: string | null;
  unit?: ProductUnit;
  low_stock_alert?: number;
  status?: "active" | "archived";
}

export const productsRepo = {
  create(input: CreateProductInput): Product {
    const db = getDb();
    const id = generateUUID();
    const now = nowISO();
    const product: Product = {
      id,
      name: input.name.trim(),
      name_ta: input.name_ta?.trim() || null,
      unit: input.unit || "bag",
      stock_qty: input.opening_stock || 0,
      low_stock_alert: input.low_stock_alert || 0,
      status: "active",
      created_at: now,
      updated_at: now,
      synced_at: null,
    };

    db.runSync(
      `INSERT INTO products (id, name, name_ta, unit, stock_qty, low_stock_alert, status, created_at, updated_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product.id,
        product.name,
        product.name_ta,
        product.unit,
        product.stock_qty,
        product.low_stock_alert,
        product.status,
        product.created_at,
        product.updated_at,
        product.synced_at,
      ]
    );

    return product;
  },

  getById(id: string): Product | null {
    const db = getDb();
    const row = db.getFirstSync<Product>("SELECT * FROM products WHERE id = ?", [id]);
    return row ?? null;
  },

  list(status: "active" | "archived" | "all" = "active"): Product[] {
    const db = getDb();
    if (status === "all") {
      return db.getAllSync<Product>("SELECT * FROM products ORDER BY name COLLATE NOCASE ASC");
    }
    return db.getAllSync<Product>(
      "SELECT * FROM products WHERE status = ? ORDER BY name COLLATE NOCASE ASC",
      [status]
    );
  },

  listWithCurrentPrices(status: "active" | "archived" | "all" = "active"): ProductWithPrice[] {
    const db = getDb();
    const now = nowISO();
    const whereClause = status === "all" ? "" : "WHERE p.status = ?";
    const params = status === "all" ? [now] : [now, status];

    const sql = `
      SELECT p.*,
        (SELECT ph.price_paise FROM price_history ph
         WHERE ph.product_id = p.id AND ph.effective_from <= ?
         ORDER BY ph.effective_from DESC, ph.created_at DESC LIMIT 1) AS current_price_paise
      FROM products p
      ${whereClause}
      ORDER BY p.name COLLATE NOCASE ASC
    `;

    return db.getAllSync<ProductWithPrice>(sql, params);
  },

  update(id: string, updates: UpdateProductInput): Product | null {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) return null;

    const now = nowISO();
    const updated: Product = {
      ...existing,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      name_ta: updates.name_ta !== undefined ? (updates.name_ta ? updates.name_ta.trim() : null) : existing.name_ta,
      unit: updates.unit !== undefined ? updates.unit : existing.unit,
      low_stock_alert: updates.low_stock_alert !== undefined ? updates.low_stock_alert : existing.low_stock_alert,
      status: updates.status !== undefined ? updates.status : existing.status,
      updated_at: now,
    };

    db.runSync(
      `UPDATE products
       SET name = ?, name_ta = ?, unit = ?, low_stock_alert = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [
        updated.name,
        updated.name_ta,
        updated.unit,
        updated.low_stock_alert,
        updated.status,
        updated.updated_at,
        id,
      ]
    );

    return updated;
  },

  updateStock(id: string, qtyDelta: number): boolean {
    const db = getDb();
    const now = nowISO();
    const res = db.runSync(
      "UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?",
      [qtyDelta, now, id]
    );
    return res.changes > 0;
  },

  createWithPrice(input: CreateProductInput, pricePaise: number): ProductWithPrice {
    const db = getDb();
    const now = nowISO();
    const productId = generateUUID();
    const priceId = generateUUID();
    const initialQty = input.opening_stock ? Number(input.opening_stock) : 0;
    const cleanPrice = Math.round(pricePaise);

    const product: ProductWithPrice = {
      id: productId,
      name: input.name.trim(),
      name_ta: input.name_ta ? input.name_ta.trim() : null,
      unit: input.unit || "bag",
      stock_qty: initialQty,
      low_stock_alert: input.low_stock_alert ? Number(input.low_stock_alert) : 0,
      status: "active",
      created_at: now,
      updated_at: now,
      synced_at: null,
      current_price_paise: cleanPrice,
    };

    db.withTransactionSync(() => {
      // 1. Insert product
      db.runSync(
        `INSERT INTO products (id, name, name_ta, unit, stock_qty, low_stock_alert, status, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          product.id,
          product.name,
          product.name_ta,
          product.unit,
          product.stock_qty,
          product.low_stock_alert,
          product.status,
          product.created_at,
          product.updated_at,
        ]
      );

      // 2. Insert opening stock move if initial qty > 0
      if (initialQty > 0) {
        const moveId = generateUUID();
        db.runSync(
          `INSERT INTO stock_moves (id, product_id, qty_change, reason, ref_id, created_at, synced_at)
           VALUES (?, ?, ?, 'opening_stock', NULL, ?, NULL)`,
          [moveId, product.id, initialQty, now]
        );
      }

      // 3. Insert initial price history
      db.runSync(
        `INSERT INTO price_history (id, product_id, price_paise, effective_from, created_at, synced_at)
         VALUES (?, ?, ?, ?, ?, NULL)`,
        [priceId, product.id, cleanPrice, now, now]
      );
    });

    return product;
  },

  adjustStock(productId: string, qtyDelta: number, reason: string): void {
    const db = getDb();
    const now = nowISO();
    const moveId = generateUUID();

    db.withTransactionSync(() => {
      db.runSync(
        `INSERT INTO stock_moves (id, product_id, qty_change, reason, ref_id, created_at, synced_at)
         VALUES (?, ?, ?, ?, NULL, ?, NULL)`,
        [moveId, productId, qtyDelta, reason.trim() || "manual_adjustment", now]
      );

      db.runSync(
        `UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?`,
        [qtyDelta, now, productId]
      );
    });
  },
};
