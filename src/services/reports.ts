import { getDb } from "@/db/client";
import { getTodayDateString } from "@/utils/dates";
import { CustomerWithBalance, balanceService } from "./balance";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { paiseToRupees } from "@/utils/money";

export interface DashboardMetrics {
  todayCashPaise: number;
  todayCreditPaise: number;
  todayPaymentsPaise: number;
  totalPendingPaise: number;
  topPendingCustomers: CustomerWithBalance[];
  overdueCustomers: Array<{
    customer_id: string;
    customer_name: string;
    customer_phone: string | null;
    bill_no: number;
    bill_date: string;
    due_date: string;
    bill_total_paise: number;
    current_balance_paise: number;
  }>;
}

export interface ProductSalesReport {
  product_id: string;
  product_name: string;
  unit: string;
  total_qty: number;
  total_amount_paise: number;
}

export interface PeriodSummary {
  cashSalesPaise: number;
  creditSalesPaise: number;
  paymentsReceivedPaise: number;
  totalSalesPaise: number;
  productSales: ProductSalesReport[];
}

function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=\+\-@]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export const reportsService = {
  getDashboardMetrics(): DashboardMetrics {
    const db = getDb();
    const today = getTodayDateString();

    // 1. Today's cash sales
    const todayCashRow = db.getFirstSync<{ total: number | null }>(
      `SELECT SUM(total_paise) AS total FROM bills
       WHERE type = 'cash' AND bill_date = ? AND status = 'active'`,
      [today]
    );

    // 2. Today's credit sales
    const todayCreditRow = db.getFirstSync<{ total: number | null }>(
      `SELECT SUM(total_paise) AS total FROM bills
       WHERE type = 'credit' AND bill_date = ? AND status = 'active'`,
      [today]
    );

    // 3. Today's payments received
    const todayPaymentsRow = db.getFirstSync<{ total: number | null }>(
      `SELECT SUM(amount_paise) AS total FROM payments
       WHERE pay_date = ? AND status = 'active'`,
      [today]
    );

    // 4. All customer balances
    const allBalances = balanceService.getAllBalances("active");
    const totalPending = allBalances.reduce(
      (sum, c) => sum + (c.balance_paise > 0 ? c.balance_paise : 0),
      0
    );

    // Top 5 pending customers
    const topPending = allBalances
      .filter((c) => c.balance_paise > 0)
      .slice(0, 5);

    // 6. Overdue customers: Customers with pending balance whose oldest unpaid credit bill has due_date < today
    const overdueList: DashboardMetrics["overdueCustomers"] = [];
    const pendingCustomers = allBalances.filter((c) => c.balance_paise > 0);

    for (const cust of pendingCustomers) {
      const creditBills = db.getAllSync<{
        bill_no: number;
        bill_date: string;
        due_date: string | null;
        total_paise: number;
      }>(
        `SELECT bill_no, bill_date, due_date, total_paise
         FROM bills
         WHERE customer_id = ? AND type = 'credit' AND status = 'active'
         ORDER BY bill_date ASC, created_at ASC`,
        [cust.id]
      );

      const totalPaymentsRow = db.getFirstSync<{ total: number | null }>(
        `SELECT SUM(amount_paise) AS total FROM payments WHERE customer_id = ? AND status = 'active'`,
        [cust.id]
      );
      let paymentPool = totalPaymentsRow?.total || 0;

      for (const bill of creditBills) {
        const billOutstanding = bill.total_paise;
        if (paymentPool >= billOutstanding) {
          paymentPool -= billOutstanding;
        } else {
          const unpaidRemainder = billOutstanding - paymentPool;
          paymentPool = 0; // Pool exhausted
          
          if (bill.due_date && bill.due_date < today) {
            overdueList.push({
              customer_id: cust.id,
              customer_name: cust.name,
              customer_phone: cust.phone,
              bill_no: bill.bill_no,
              bill_date: bill.bill_date,
              due_date: bill.due_date,
              bill_total_paise: unpaidRemainder,
              current_balance_paise: cust.balance_paise,
            });
            // We found the oldest overdue bill for this customer.
            // In dashboard we usually show one entry per customer.
            break; 
          }
          // If this bill isn't overdue yet, we should NOT break yet, 
          // because a newer bill might have a shorter due date.
          // However, bills are ordered by date, and usually due dates are sequential.
          // But to be safe, we continue checking.
        }
      }
    }

    return {
      todayCashPaise: todayCashRow?.total || 0,
      todayCreditPaise: todayCreditRow?.total || 0,
      todayPaymentsPaise: todayPaymentsRow?.total || 0,
      totalPendingPaise: totalPending,
      topPendingCustomers: topPending,
      overdueCustomers: overdueList,
    };
  },

  getPeriodSummary(startDate: string, endDate: string): PeriodSummary {
    const db = getDb();

    // Sales by type
    const cashRow = db.getFirstSync<{ total: number | null }>(
      `SELECT SUM(total_paise) AS total FROM bills
       WHERE type = 'cash' AND bill_date BETWEEN ? AND ? AND status = 'active'`,
      [startDate, endDate]
    );

    const creditRow = db.getFirstSync<{ total: number | null }>(
      `SELECT SUM(total_paise) AS total FROM bills
       WHERE type = 'credit' AND bill_date BETWEEN ? AND ? AND status = 'active'`,
      [startDate, endDate]
    );

    const payRow = db.getFirstSync<{ total: number | null }>(
      `SELECT SUM(amount_paise) AS total FROM payments
       WHERE pay_date BETWEEN ? AND ? AND status = 'active'`,
      [startDate, endDate]
    );

    const cashSales = cashRow?.total || 0;
    const creditSales = creditRow?.total || 0;
    const payments = payRow?.total || 0;

    // Product-wise sales breakdown
    const productSales = db.getAllSync<ProductSalesReport>(
      `SELECT p.id AS product_id, p.name AS product_name, p.unit,
              SUM(bi.qty) AS total_qty,
              SUM(bi.amount_paise) AS total_amount_paise
       FROM bill_items bi
       JOIN bills b ON bi.bill_id = b.id
       JOIN products p ON bi.product_id = p.id
       WHERE b.bill_date BETWEEN ? AND ? AND b.status = 'active'
       GROUP BY p.id, p.name, p.unit
       ORDER BY total_amount_paise DESC`,
      [startDate, endDate]
    );

    return {
      cashSalesPaise: cashSales,
      creditSalesPaise: creditSales,
      paymentsReceivedPaise: payments,
      totalSalesPaise: cashSales + creditSales,
      productSales,
    };
  },

  async exportToCSV(type: "customers" | "bills" | "payments"): Promise<void> {
    const db = getDb();
    let csv = "";
    let filename = "";

    if (type === "customers") {
      filename = `customers_ledger_${getTodayDateString()}.csv`;
      csv = "Name,Phone,Village,Pending_Balance_Rupees\n";
      const balances = balanceService.getAllBalances("active");
      for (const c of balances) {
        csv += `${escapeCsvCell(c.name)},${escapeCsvCell(c.phone)},${escapeCsvCell(c.village)},${paiseToRupees(c.balance_paise)}\n`;
      }
    } else if (type === "bills") {
      filename = `bills_export_${getTodayDateString()}.csv`;
      csv = "Bill_No,Date,Type,Customer,Total_Rupees,Status\n";
      const bills = db.getAllSync<{
        bill_no: number;
        bill_date: string;
        type: string;
        customer_name: string | null;
        total_paise: number;
        status: string;
      }>(
        `SELECT b.bill_no, b.bill_date, b.type, c.name AS customer_name, b.total_paise, b.status
         FROM bills b
         LEFT JOIN customers c ON b.customer_id = c.id
         ORDER BY b.bill_date DESC, b.bill_no DESC`
      );
      for (const b of bills) {
        csv += `${b.bill_no},${escapeCsvCell(b.bill_date)},${escapeCsvCell(b.type)},${escapeCsvCell(b.customer_name || "Cash")},${paiseToRupees(b.total_paise)},${escapeCsvCell(b.status)}\n`;
      }
    } else if (type === "payments") {
      filename = `payments_export_${getTodayDateString()}.csv`;
      csv = "Date,Customer,Amount_Rupees,Mode,Note,Status\n";
      const payments = db.getAllSync<{
        pay_date: string;
        customer_name: string;
        amount_paise: number;
        mode: string;
        note: string | null;
        status: string;
      }>(
        `SELECT p.pay_date, c.name AS customer_name, p.amount_paise, p.mode, p.note, p.status
         FROM payments p
         JOIN customers c ON p.customer_id = c.id
         ORDER BY p.pay_date DESC`
      );
      for (const p of payments) {
        csv += `${escapeCsvCell(p.pay_date)},${escapeCsvCell(p.customer_name)},${paiseToRupees(p.amount_paise)},${escapeCsvCell(p.mode)},${escapeCsvCell(p.note)},${escapeCsvCell(p.status)}\n`;
      }
    }

    const fileUri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, { mimeType: "text/csv", UTI: "public.comma-separated-values-text" });
    }
  },
};
