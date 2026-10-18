import type { SQLiteDatabase } from "expo-sqlite";

export class MockDatabase {
  customers: any[] = [];
  products: any[] = [];
  price_history: any[] = [];
  bills: any[] = [];
  bill_items: any[] = [];
  payments: any[] = [];
  stock_moves: any[] = [];
  settings: Record<string, string> = {
    mill_name: "Cattle Feed Mill",
    mill_phone: "",
    language: "en",
  };
  schema_version: any[] = [];

  execSync(_sql: string): void {
    // Schema creation or PRAGMA statements
  }

  runSync(sql: string, params: any[] = []): { changes: number; lastInsertRowId: number } {
    const trimmed = sql.trim().toUpperCase();

    if (trimmed.startsWith("INSERT INTO PRICE_HISTORY")) {
      const [id, product_id, price_paise, effective_from, created_at, synced_at] = params;
      this.price_history.push({
        id,
        product_id,
        price_paise,
        effective_from,
        created_at,
        synced_at,
      });
      return { changes: 1, lastInsertRowId: this.price_history.length };
    }

    if (trimmed.startsWith("INSERT INTO CUSTOMERS")) {
      const [id, name, phone, village, credit_limit_paise, notes, status, created_at, updated_at, synced_at] = params;
      this.customers.push({
        id,
        name,
        phone,
        village,
        credit_limit_paise,
        notes,
        status,
        created_at,
        updated_at,
        synced_at,
      });
      return { changes: 1, lastInsertRowId: this.customers.length };
    }

    if (trimmed.startsWith("INSERT INTO PRODUCTS")) {
      const [id, name, name_ta, unit, stock_qty, low_stock_alert, status, created_at, updated_at, synced_at] = params;
      this.products.push({
        id,
        name,
        name_ta,
        unit,
        stock_qty,
        low_stock_alert,
        status,
        created_at,
        updated_at,
        synced_at,
      });
      return { changes: 1, lastInsertRowId: this.products.length };
    }

    if (trimmed.startsWith("INSERT INTO BILLS")) {
      const [id, bill_no, customer_id, type, bill_date, due_date, total_paise, note, created_at, updated_at] = params;
      this.bills.push({
        id,
        bill_no,
        customer_id,
        type,
        bill_date,
        due_date,
        total_paise,
        note,
        status: "active",
        created_at,
        updated_at,
        synced_at: null,
      });
      return { changes: 1, lastInsertRowId: this.bills.length };
    }

    if (trimmed.startsWith("INSERT INTO BILL_ITEMS")) {
      const [id, bill_id, product_id, qty, price_paise, amount_paise] = params;
      this.bill_items.push({
        id,
        bill_id,
        product_id,
        qty,
        price_paise,
        amount_paise,
        synced_at: null,
      });
      return { changes: 1, lastInsertRowId: this.bill_items.length };
    }

    if (trimmed.startsWith("INSERT INTO PAYMENTS")) {
      const [id, customer_id, amount_paise, pay_date, mode, note, created_at, updated_at] = params;
      this.payments.push({
        id,
        customer_id,
        amount_paise,
        pay_date,
        mode,
        note,
        status: "active",
        created_at,
        updated_at,
        synced_at: null,
      });
      return { changes: 1, lastInsertRowId: this.payments.length };
    }

    if (trimmed.startsWith("INSERT INTO STOCK_MOVES")) {
      let id, product_id, qty_change, reason, ref_id, created_at, synced_at;
      if (trimmed.includes("'OPENING_STOCK'")) {
        [id, product_id, qty_change, created_at] = params;
        reason = "opening_stock";
        ref_id = null;
      } else if (trimmed.includes("'SALE'")) {
        [id, product_id, qty_change, ref_id, created_at] = params;
        reason = "sale";
      } else if (trimmed.includes("'CANCEL'")) {
        [id, product_id, qty_change, ref_id, created_at] = params;
        reason = "cancel";
      } else if (params.length === 5) {
        [id, product_id, qty_change, reason, created_at] = params;
        ref_id = null;
      } else {
        [id, product_id, qty_change, reason, ref_id, created_at, synced_at] = params;
      }
      this.stock_moves.push({
        id,
        product_id,
        qty_change,
        reason,
        ref_id: ref_id || null,
        created_at,
        synced_at: synced_at || null,
      });
      return { changes: 1, lastInsertRowId: this.stock_moves.length };
    }

    if (trimmed.startsWith("UPDATE CUSTOMERS")) {
      const id = params[params.length - 1];
      const idx = this.customers.findIndex((c) => c.id === id);
      if (idx !== -1) {
        if (params.length === 2) {
          // archive: status = 'archived', updated_at = ? WHERE id = ?
          this.customers[idx].status = "archived";
          this.customers[idx].updated_at = params[0];
        } else {
          const [name, phone, village, credit_limit_paise, notes, status, updated_at] = params;
          this.customers[idx] = {
            ...this.customers[idx],
            name,
            phone,
            village,
            credit_limit_paise,
            notes,
            status,
            updated_at,
          };
        }
        return { changes: 1, lastInsertRowId: idx };
      }
      return { changes: 0, lastInsertRowId: 0 };
    }

    if (trimmed.startsWith("UPDATE PRODUCTS SET STOCK_QTY = STOCK_QTY +") || trimmed.startsWith("UPDATE PRODUCTS SET STOCK_QTY = STOCK_QTY -")) {
      const isMinus = trimmed.includes("STOCK_QTY -");
      const [qtyDelta, updatedAt, id] = params;
      const idx = this.products.findIndex((p) => p.id === id);
      if (idx !== -1) {
        this.products[idx].stock_qty += isMinus ? -qtyDelta : qtyDelta;
        this.products[idx].updated_at = updatedAt;
        return { changes: 1, lastInsertRowId: idx };
      }
      return { changes: 0, lastInsertRowId: 0 };
    }

    if (trimmed.startsWith("UPDATE BILLS SET STATUS = 'CANCELLED'")) {
      const [updatedAt, id] = params;
      const idx = this.bills.findIndex((b) => b.id === id);
      if (idx !== -1) {
        this.bills[idx].status = "cancelled";
        this.bills[idx].updated_at = updatedAt;
        return { changes: 1, lastInsertRowId: idx };
      }
      return { changes: 0, lastInsertRowId: 0 };
    }

    if (trimmed.startsWith("UPDATE PAYMENTS SET STATUS = 'CANCELLED'")) {
      const [updatedAt, id] = params;
      const idx = this.payments.findIndex((p) => p.id === id);
      if (idx !== -1) {
        this.payments[idx].status = "cancelled";
        this.payments[idx].updated_at = updatedAt;
        return { changes: 1, lastInsertRowId: idx };
      }
      return { changes: 0, lastInsertRowId: 0 };
    }

    if (trimmed.startsWith("INSERT INTO SETTINGS")) {
      const [key, value] = params;
      this.settings[key] = value;
      return { changes: 1, lastInsertRowId: 1 };
    }

    if (trimmed.startsWith("INSERT INTO SCHEMA_VERSION")) {
      const [version, name, applied_at] = params;
      this.schema_version.push({ version, name, applied_at });
      return { changes: 1, lastInsertRowId: this.schema_version.length };
    }

    return { changes: 0, lastInsertRowId: 0 };
  }

  getFirstSync<T>(sql: string, params: any[] = []): T | null {
    const trimmed = sql.trim().toUpperCase();

    if (trimmed.includes("FROM SETTINGS WHERE KEY = ?")) {
      const [key] = params;
      const val = this.settings[key];
      return val !== undefined ? (({ value: val } as unknown) as T) : null;
    }

    if (trimmed.includes("FROM PRICE_HISTORY") && trimmed.includes("WHERE PRODUCT_ID = ? AND EFFECTIVE_FROM <= ?")) {
      const [productId, targetDate] = params;
      const matching = this.price_history
        .filter((p) => p.product_id === productId && p.effective_from <= targetDate)
        .sort((a, b) => {
          if (a.effective_from !== b.effective_from) {
            return b.effective_from.localeCompare(a.effective_from);
          }
          return b.created_at.localeCompare(a.created_at);
        });

      return (matching[0] as T) || null;
    }

    if (trimmed.includes("FROM CUSTOMERS WHERE ID = ?")) {
      const [id] = params;
      const found = this.customers.find((c) => c.id === id);
      return (found as T) || null;
    }

    if (trimmed.includes("FROM PRODUCTS WHERE ID = ?")) {
      const [id] = params;
      const found = this.products.find((p) => p.id === id);
      return (found as T) || null;
    }

    if (trimmed.includes("SELECT COALESCE(MAX(BILL_NO), 0) + 1 AS NEXT_NO FROM BILLS")) {
      const maxNo = this.bills.reduce((max, b) => Math.max(max, b.bill_no || 0), 0);
      return ({ next_no: maxNo + 1 } as unknown) as T;
    }

    if (trimmed.includes("FROM BILLS WHERE ID = ?")) {
      const [id] = params;
      const found = this.bills.find((b) => b.id === id);
      return (found as T) || null;
    }

    if (trimmed.includes("SUM(TOTAL_PAISE)") && trimmed.includes("FROM BILLS")) {
      const [customerId] = params;
      const total = this.bills
        .filter((b) => b.customer_id === customerId && b.type === "credit" && b.status === "active")
        .reduce((sum, b) => sum + b.total_paise, 0);
      return ({ total } as unknown) as T;
    }

    if (trimmed.includes("SUM(AMOUNT_PAISE)") && trimmed.includes("FROM PAYMENTS")) {
      const [customerId] = params;
      const total = this.payments
        .filter((p) => p.customer_id === customerId && p.status === "active")
        .reduce((sum, p) => sum + p.amount_paise, 0);
      return ({ total } as unknown) as T;
    }

    return null;
  }

  getAllSync<T>(sql: string, params: any[] = []): T[] {
    const trimmed = sql.trim().toUpperCase();

    if (trimmed.includes("FROM SCHEMA_VERSION")) {
      return this.schema_version as T[];
    }

    if (trimmed.includes("FROM PRICE_HISTORY WHERE PRODUCT_ID = ?")) {
      const [productId] = params;
      return this.price_history
        .filter((p) => p.product_id === productId)
        .sort((a, b) => b.effective_from.localeCompare(a.effective_from)) as T[];
    }

    if (trimmed.includes("FROM CUSTOMERS")) {
      if (params.length === 1) {
        return this.customers.filter((c) => c.status === params[0]) as T[];
      }
      return this.customers as T[];
    }

    if (trimmed.includes("FROM PRODUCTS")) {
      if (trimmed.includes("CURRENT_PRICE_PAISE")) {
        const now = params[0] || new Date().toISOString();
        const statusFilter = params.length > 1 ? params[1] : null;
        return this.products
          .filter((p) => (statusFilter ? p.status === statusFilter : true))
          .map((p) => {
            const ph = this.price_history
              .filter((h) => h.product_id === p.id && h.effective_from <= now)
              .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
            return {
              ...p,
              current_price_paise: ph ? ph.price_paise : null,
            };
          }) as T[];
      }
      if (params.length === 1) {
        return this.products.filter((p) => p.status === params[0]) as T[];
      }
      return this.products as T[];
    }

    if (trimmed.includes("FROM BILL_ITEMS") && trimmed.includes("BILL_ID = ?")) {
      const [billId] = params;
      return this.bill_items
        .filter((bi) => bi.bill_id === billId)
        .map((bi) => {
          const prod = this.products.find((p) => p.id === bi.product_id);
          return {
            ...bi,
            product_name: prod?.name || "Product",
            product_name_ta: prod?.name_ta || null,
            unit: prod?.unit || "bag",
          };
        }) as T[];
    }

    if (trimmed.includes("FROM BILLS") && trimmed.includes("CUSTOMER_ID = ?")) {
      const [customerId] = params;
      return this.bills
        .filter((b) => b.customer_id === customerId && (trimmed.includes("TYPE = 'CREDIT'") ? b.type === "credit" : true))
        .map((b) => ({
          id: b.id,
          bill_no: b.bill_no,
          bill_date: b.bill_date,
          total_paise: b.total_paise,
          note: b.note,
          status: b.status,
        })) as T[];
    }

    if (trimmed.includes("FROM PAYMENTS") && trimmed.includes("CUSTOMER_ID = ?")) {
      const [customerId] = params;
      return this.payments
        .filter((p) => p.customer_id === customerId)
        .map((p) => ({
          id: p.id,
          pay_date: p.pay_date,
          amount_paise: p.amount_paise,
          mode: p.mode,
          note: p.note,
          status: p.status,
        })) as T[];
    }

    return [];
  }

  withTransactionSync<T>(action: () => T): T {
    return action();
  }
}

export function createMockDatabase(): SQLiteDatabase {
  return new MockDatabase() as unknown as SQLiteDatabase;
}
