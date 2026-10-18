import { getDb } from "@/db/client";
import { Customer } from "@/db/repositories/customersRepo";

export interface CustomerWithBalance extends Customer {
  balance_paise: number;
}

export interface LedgerItem {
  id: string;
  kind: "bill" | "payment";
  date: string;
  amount_paise: number;
  ref_no: number | null;
  mode: string | null;
  note: string | null;
  status: "active" | "cancelled";
  running_balance_paise: number;
}

export const balanceService = {
  /**
   * Calculates current balance for a single customer.
   * Strictly adheres to Non-negotiable Rule 3:
   * Balance = sum(active credit bills) - sum(active payments).
   */
  getCustomerBalance(customerId: string): number {
    const db = getDb();

    const billRow = db.getFirstSync<{ total: number | null }>(
      `SELECT SUM(total_paise) AS total FROM bills
       WHERE customer_id = ? AND type = 'credit' AND status = 'active'`,
      [customerId]
    );

    const paymentRow = db.getFirstSync<{ total: number | null }>(
      `SELECT SUM(amount_paise) AS total FROM payments
       WHERE customer_id = ? AND status = 'active'`,
      [customerId]
    );

    const totalCredit = billRow?.total ?? 0;
    const totalPayments = paymentRow?.total ?? 0;

    return totalCredit - totalPayments;
  },

  /**
   * Retrieves all customers with their dynamically calculated balances.
   * Sorted by highest pending balance first.
   */
  getAllBalances(status: "active" | "archived" | "all" = "active"): CustomerWithBalance[] {
    const db = getDb();
    const where = status === "all" ? "" : "WHERE c.status = ?";
    const params = status === "all" ? [] : [status];

    const sql = `
      SELECT c.*,
        COALESCE((SELECT SUM(b.total_paise) FROM bills b
                  WHERE b.customer_id = c.id AND b.type = 'credit' AND b.status = 'active'), 0)
        - COALESCE((SELECT SUM(p.amount_paise) FROM payments p
                    WHERE p.customer_id = c.id AND p.status = 'active'), 0) AS balance_paise
      FROM customers c
      ${where}
      ORDER BY balance_paise DESC, c.name COLLATE NOCASE ASC
    `;

    return db.getAllSync<CustomerWithBalance>(sql, params);
  },

  /**
   * Generates chronological ledger with running balance for a customer.
   * Active bills add to balance; active payments reduce balance.
   */
  getLedger(customerId: string): LedgerItem[] {
    const db = getDb();

    // Query active credit bills
    const bills = db.getAllSync<{
      id: string;
      bill_no: number;
      bill_date: string;
      total_paise: number;
      note: string | null;
      status: "active" | "cancelled";
      created_at: string;
    }>(
      `SELECT id, bill_no, bill_date, total_paise, note, status, created_at
       FROM bills
       WHERE customer_id = ? AND type = 'credit'
       ORDER BY bill_date ASC, created_at ASC`,
      [customerId]
    );

    // Query active payments
    const payments = db.getAllSync<{
      id: string;
      pay_date: string;
      amount_paise: number;
      mode: string;
      note: string | null;
      status: "active" | "cancelled";
      created_at: string;
    }>(
      `SELECT id, pay_date, amount_paise, mode, note, status, created_at
       FROM payments
       WHERE customer_id = ?
       ORDER BY pay_date ASC, created_at ASC`,
      [customerId]
    );

    // Combine and sort chronologically (oldest first)
    type RawEntry = {
      id: string;
      kind: "bill" | "payment";
      date: string;
      created_at: string;
      amount_paise: number;
      ref_no: number | null;
      mode: string | null;
      note: string | null;
      status: "active" | "cancelled";
    };

    const combined: RawEntry[] = [];

    for (const b of bills) {
      combined.push({
        id: b.id,
        kind: "bill",
        date: b.bill_date,
        created_at: b.created_at,
        amount_paise: b.total_paise,
        ref_no: b.bill_no,
        mode: null,
        note: b.note,
        status: b.status,
      });
    }

    for (const p of payments) {
      combined.push({
        id: p.id,
        kind: "payment",
        date: p.pay_date,
        created_at: p.created_at,
        amount_paise: p.amount_paise,
        ref_no: null,
        mode: p.mode,
        note: p.note,
        status: p.status,
      });
    }

    combined.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.created_at.localeCompare(b.created_at);
    });

    // Calculate running balance
    let runningBalance = 0;
    const ledger: LedgerItem[] = [];

    for (const entry of combined) {
      if (entry.status === "active") {
        if (entry.kind === "bill") {
          runningBalance += entry.amount_paise;
        } else {
          runningBalance -= entry.amount_paise;
        }
      }

      ledger.push({
        ...entry,
        running_balance_paise: runningBalance,
      });
    }

    return ledger;
  },
};
