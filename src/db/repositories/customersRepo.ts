import { generateUUID } from "@/utils/uuid";
import { getDb } from "../client";
import { nowISO } from "@/utils/dates";

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  village: string | null;
  credit_limit_paise: number;
  notes: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
  village?: string | null;
  credit_limit_paise?: number;
  notes?: string | null;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string | null;
  village?: string | null;
  credit_limit_paise?: number;
  notes?: string | null;
  status?: "active" | "archived";
}

export const customersRepo = {
  create(input: CreateCustomerInput): Customer {
    const db = getDb();
    const id = generateUUID();
    const now = nowISO();
    const customer: Customer = {
      id,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      village: input.village?.trim() || null,
      credit_limit_paise: input.credit_limit_paise ? Math.round(input.credit_limit_paise) : 0,
      notes: input.notes?.trim() || null,
      status: "active",
      created_at: now,
      updated_at: now,
      synced_at: null,
    };

    db.runSync(
      `INSERT INTO customers (id, name, phone, village, credit_limit_paise, notes, status, created_at, updated_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer.id,
        customer.name,
        customer.phone,
        customer.village,
        customer.credit_limit_paise,
        customer.notes,
        customer.status,
        customer.created_at,
        customer.updated_at,
        customer.synced_at,
      ]
    );

    return customer;
  },

  getById(id: string): Customer | null {
    const db = getDb();
    const row = db.getFirstSync<Customer>("SELECT * FROM customers WHERE id = ?", [id]);
    return row ?? null;
  },

  list(status: "active" | "archived" | "all" = "active"): Customer[] {
    const db = getDb();
    if (status === "all") {
      return db.getAllSync<Customer>("SELECT * FROM customers ORDER BY name COLLATE NOCASE ASC");
    }
    return db.getAllSync<Customer>(
      "SELECT * FROM customers WHERE status = ? ORDER BY name COLLATE NOCASE ASC",
      [status]
    );
  },

  search(query: string, status: "active" | "archived" | "all" = "active"): Customer[] {
    const db = getDb();
    const pattern = `%${query.trim()}%`;
    if (status === "all") {
      return db.getAllSync<Customer>(
        "SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR village LIKE ? ORDER BY name COLLATE NOCASE ASC",
        [pattern, pattern, pattern]
      );
    }
    return db.getAllSync<Customer>(
      "SELECT * FROM customers WHERE status = ? AND (name LIKE ? OR phone LIKE ? OR village LIKE ?) ORDER BY name COLLATE NOCASE ASC",
      [status, pattern, pattern, pattern]
    );
  },

  update(id: string, updates: UpdateCustomerInput): Customer | null {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) return null;

    const now = nowISO();
    const updated: Customer = {
      ...existing,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      phone: updates.phone !== undefined ? (updates.phone ? updates.phone.trim() : null) : existing.phone,
      village: updates.village !== undefined ? (updates.village ? updates.village.trim() : null) : existing.village,
      credit_limit_paise: updates.credit_limit_paise !== undefined ? Math.round(updates.credit_limit_paise || 0) : existing.credit_limit_paise,
      notes: updates.notes !== undefined ? (updates.notes ? updates.notes.trim() : null) : existing.notes,
      status: updates.status !== undefined ? updates.status : existing.status,
      updated_at: now,
    };

    db.runSync(
      `UPDATE customers
       SET name = ?, phone = ?, village = ?, credit_limit_paise = ?, notes = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [
        updated.name,
        updated.phone,
        updated.village,
        updated.credit_limit_paise,
        updated.notes,
        updated.status,
        updated.updated_at,
        id,
      ]
    );

    return updated;
  },

  archive(id: string): boolean {
    const db = getDb();
    const now = nowISO();
    const result = db.runSync(
      "UPDATE customers SET status = 'archived', updated_at = ? WHERE id = ?",
      [now, id]
    );
    return result.changes > 0;
  },
};
