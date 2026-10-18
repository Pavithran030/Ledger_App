import { generateUUID } from "@/utils/uuid";
import { getDb } from "../client";
import { nowISO, getTodayDateString } from "@/utils/dates";
import { calculateLineAmountPaise } from "@/utils/money";
import type { PaymentMode } from "./paymentsRepo";

export interface Bill {
  id: string;
  bill_no: number;
  customer_id: string | null;
  type: "cash" | "credit";
  bill_date: string;
  due_date: string | null;
  total_paise: number;
  note: string | null;
  status: "active" | "cancelled";
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface BillItem {
  id: string;
  bill_id: string;
  product_id: string;
  qty: number;
  price_paise: number;
  amount_paise: number;
  synced_at: string | null;
}

export interface BillItemWithProduct extends BillItem {
  product_name: string;
  product_name_ta: string | null;
  unit: string;
}

export interface BillDetail extends Bill {
  customer_name: string | null;
  customer_phone: string | null;
  items: BillItemWithProduct[];
}

export interface CreateBillItemInput {
  product_id: string;
  qty: number;
  price_paise: number;
}

/** Optional money received from the customer at the moment of the sale. */
export interface CreateBillPaymentInput {
  amount_paise: number;
  mode?: PaymentMode;
  pay_date?: string;
  note?: string | null;
}

export interface CreateBillInput {
  customer_id: string | null;
  type: "cash" | "credit";
  bill_date?: string;
  due_date?: string | null;
  note?: string | null;
  items: CreateBillItemInput[];
  payment?: CreateBillPaymentInput | null;
}

export const billsRepo = {
  /**
   * Creates a bill, its items, and corresponding stock deductions inside ONE SQLite transaction.
   * Strictly adheres to Non-negotiable Rules 1, 2, 4, 5, 8, 10.
   */
  createBill(input: CreateBillInput): BillDetail {
    if (input.items.length === 0) {
      throw new Error("A sale must contain at least one item");
    }
    if (input.type === "credit" && !input.customer_id) {
      throw new Error("Credit sale requires a valid customer");
    }
    if (input.payment && input.payment.amount_paise > 0 && !input.customer_id) {
      throw new Error("A payment can only be recorded against a registered customer");
    }

    const db = getDb();
    const billId = generateUUID();
    const now = nowISO();
    const billDate = input.bill_date || getTodayDateString();

    let grandTotalPaise = 0;
    const computedItems: Array<BillItem & { unit: string; product_name: string; product_name_ta: string | null }> = [];

    for (const it of input.items) {
      const lineTotal = calculateLineAmountPaise(it.qty, it.price_paise);
      grandTotalPaise += lineTotal;

      const product = db.getFirstSync<{ name: string; name_ta: string | null; unit: string }>(
        "SELECT name, name_ta, unit FROM products WHERE id = ?",
        [it.product_id]
      );

      computedItems.push({
        id: generateUUID(),
        bill_id: billId,
        product_id: it.product_id,
        qty: it.qty,
        price_paise: it.price_paise,
        amount_paise: lineTotal,
        synced_at: null,
        product_name: product?.name || "Product",
        product_name_ta: product?.name_ta || null,
        unit: product?.unit || "bag",
      });
    }

    let createdBillNo = 1;

    // Single atomic transaction for all tables (bills, bill_items, stock_moves, products)
    db.withTransactionSync(() => {
      const maxRow = db.getFirstSync<{ next_no: number }>(
        "SELECT COALESCE(MAX(bill_no), 0) + 1 AS next_no FROM bills"
      );
      createdBillNo = maxRow?.next_no || 1;

      // 1. Insert into bills
      db.runSync(
        `INSERT INTO bills (id, bill_no, customer_id, type, bill_date, due_date, total_paise, note, status, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL)`,
        [
          billId,
          createdBillNo,
          input.customer_id,
          input.type,
          billDate,
          input.due_date || null,
          grandTotalPaise,
          input.note?.trim() || null,
          now,
          now,
        ]
      );

      // 2. Insert items and stock movements
      for (const item of computedItems) {
        db.runSync(
          `INSERT INTO bill_items (id, bill_id, product_id, qty, price_paise, amount_paise, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL)`,
          [
            item.id,
            item.bill_id,
            item.product_id,
            item.qty,
            item.price_paise,
            item.amount_paise,
          ]
        );

        // Record stock reduction move
        const moveId = generateUUID();
        db.runSync(
          `INSERT INTO stock_moves (id, product_id, qty_change, reason, ref_id, created_at, synced_at)
           VALUES (?, ?, ?, 'sale', ?, ?, NULL)`,
          [moveId, item.product_id, -item.qty, billId, now]
        );

        // Deduct inventory in products table
        db.runSync(
          `UPDATE products SET stock_qty = stock_qty - ?, updated_at = ? WHERE id = ?`,
          [item.qty, now, item.product_id]
        );
      }

      // 3. Record money received at the time of the sale (same transaction).
      //    Balance is always derived from rows (Rule 3), so a partial or full
      //    payment simply reduces the customer's outstanding balance.
      if (input.payment && input.customer_id && input.payment.amount_paise > 0) {
        db.runSync(
          `INSERT INTO payments (id, customer_id, amount_paise, pay_date, mode, note, status, created_at, updated_at, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL)`,
          [
            generateUUID(),
            input.customer_id,
            Math.round(input.payment.amount_paise),
            input.payment.pay_date || billDate,
            input.payment.mode || "cash",
            input.payment.note?.trim() || null,
            now,
            now,
          ]
        );
      }
    });

    const customer = input.customer_id
      ? db.getFirstSync<{ name: string; phone: string | null }>(
          "SELECT name, phone FROM customers WHERE id = ?",
          [input.customer_id]
        )
      : null;

    return {
      id: billId,
      bill_no: createdBillNo,
      customer_id: input.customer_id,
      customer_name: customer?.name || null,
      customer_phone: customer?.phone || null,
      type: input.type,
      bill_date: billDate,
      due_date: input.due_date || null,
      total_paise: grandTotalPaise,
      note: input.note?.trim() || null,
      status: "active",
      created_at: now,
      updated_at: now,
      synced_at: null,
      items: computedItems,
    };
  },

  /**
   * Cancels a bill without hard deletion (Non-negotiable Rule 4).
   * Restores inventory via reversing stock moves in a single transaction.
   */
  cancelBill(billId: string): boolean {
    const db = getDb();
    const bill = db.getFirstSync<Bill>("SELECT * FROM bills WHERE id = ?", [billId]);
    if (!bill || bill.status === "cancelled") {
      return false;
    }

    const items = db.getAllSync<BillItem>(
      "SELECT * FROM bill_items WHERE bill_id = ?",
      [billId]
    );

    const now = nowISO();

    db.withTransactionSync(() => {
      // 1. Mark bill cancelled
      db.runSync(
        "UPDATE bills SET status = 'cancelled', updated_at = ? WHERE id = ?",
        [now, billId]
      );

      // 2. Reverse stock moves for every item
      for (const item of items) {
        const moveId = generateUUID();
        db.runSync(
          `INSERT INTO stock_moves (id, product_id, qty_change, reason, ref_id, created_at, synced_at)
           VALUES (?, ?, ?, 'cancel', ?, ?, NULL)`,
          [moveId, item.product_id, item.qty, billId, now]
        );

        // Restore product stock
        db.runSync(
          `UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?`,
          [item.qty, now, item.product_id]
        );
      }
    });

    return true;
  },

  getById(billId: string): BillDetail | null {
    const db = getDb();
    const bill = db.getFirstSync<Bill>("SELECT * FROM bills WHERE id = ?", [billId]);
    if (!bill) return null;

    const customer = bill.customer_id
      ? db.getFirstSync<{ name: string; phone: string | null }>(
          "SELECT name, phone FROM customers WHERE id = ?",
          [bill.customer_id]
        )
      : null;

    const items = db.getAllSync<BillItemWithProduct>(
      `SELECT bi.*, COALESCE(p.name, 'Unknown Product') AS product_name, p.name_ta AS product_name_ta, COALESCE(p.unit, 'unit') AS unit
       FROM bill_items bi
       LEFT JOIN products p ON bi.product_id = p.id
       WHERE bi.bill_id = ?`,
      [billId]
    );

    return {
      ...bill,
      customer_name: customer?.name || null,
      customer_phone: customer?.phone || null,
      items,
    };
  },

  createOpeningBalanceBill(
    customerId: string,
    amountPaise: number,
    note?: string
  ): Bill {
    const db = getDb();
    const now = nowISO();
    const today = getTodayDateString();
    const billId = generateUUID();
    const cleanAmount = Math.round(amountPaise);

    let createdBill: Bill | null = null;

    db.withTransactionSync(() => {
      const maxNoRow = db.getFirstSync<{ next_no: number }>(
        "SELECT COALESCE(MAX(bill_no), 0) + 1 AS next_no FROM bills"
      );
      const nextBillNo = maxNoRow?.next_no || 1;

      createdBill = {
        id: billId,
        bill_no: nextBillNo,
        customer_id: customerId,
        type: "credit",
        bill_date: today,
        due_date: null,
        total_paise: cleanAmount,
        note: note || "Opening Balance",
        status: "active",
        created_at: now,
        updated_at: now,
        synced_at: null,
      };

      db.runSync(
        `INSERT INTO bills (id, bill_no, customer_id, type, bill_date, due_date, total_paise, note, status, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL)`,
        [
          createdBill.id,
          createdBill.bill_no,
          createdBill.customer_id,
          createdBill.type,
          createdBill.bill_date,
          createdBill.due_date,
          createdBill.total_paise,
          createdBill.note,
          createdBill.created_at,
          createdBill.updated_at,
        ]
      );
    });

    if (!createdBill) {
      throw new Error("Failed to create opening balance bill");
    }

    return createdBill;
  },

  listRecent(limit = 50): Bill[] {
    const db = getDb();
    return db.getAllSync<Bill>(
      "SELECT * FROM bills ORDER BY bill_date DESC, created_at DESC LIMIT ?",
      [limit]
    );
  },
};
