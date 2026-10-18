import { generateUUID } from "@/utils/uuid";
import { getDb } from "../client";
import { nowISO, getTodayDateString } from "@/utils/dates";

export type PaymentMode = "cash" | "upi" | "bank" | "other";

export interface Payment {
  id: string;
  customer_id: string;
  amount_paise: number;
  pay_date: string;
  mode: PaymentMode;
  note: string | null;
  status: "active" | "cancelled";
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface AddPaymentInput {
  customer_id: string;
  amount_paise: number;
  pay_date?: string;
  mode?: PaymentMode;
  note?: string | null;
}

export const paymentsRepo = {
  /**
   * Records a new customer payment.
   * Strictly enforces Non-negotiable Rule 1 (integer paise > 0).
   */
  addPayment(input: AddPaymentInput): Payment {
    if (input.amount_paise <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    const db = getDb();
    const id = generateUUID();
    const now = nowISO();
    const payDate = input.pay_date || getTodayDateString();
    const mode = input.mode || "cash";

    const payment: Payment = {
      id,
      customer_id: input.customer_id,
      amount_paise: Math.round(input.amount_paise),
      pay_date: payDate,
      mode,
      note: input.note?.trim() || null,
      status: "active",
      created_at: now,
      updated_at: now,
      synced_at: null,
    };

    db.runSync(
      `INSERT INTO payments (id, customer_id, amount_paise, pay_date, mode, note, status, created_at, updated_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL)`,
      [
        payment.id,
        payment.customer_id,
        payment.amount_paise,
        payment.pay_date,
        payment.mode,
        payment.note,
        payment.created_at,
        payment.updated_at,
      ]
    );

    return payment;
  },

  /**
   * Cancels a payment without hard deleting (Rule 4).
   */
  cancelPayment(paymentId: string): boolean {
    const db = getDb();
    const now = nowISO();
    const res = db.runSync(
      "UPDATE payments SET status = 'cancelled', updated_at = ? WHERE id = ?",
      [now, paymentId]
    );
    return res.changes > 0;
  },

  getById(paymentId: string): Payment | null {
    const db = getDb();
    const row = db.getFirstSync<Payment>("SELECT * FROM payments WHERE id = ?", [paymentId]);
    return row ?? null;
  },

  listByCustomer(customerId: string): Payment[] {
    const db = getDb();
    return db.getAllSync<Payment>(
      "SELECT * FROM payments WHERE customer_id = ? ORDER BY pay_date DESC, created_at DESC",
      [customerId]
    );
  },
};
