import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import { formatINR } from "@/utils/money";
import { formatDate } from "@/utils/dates";
import { settingsRepo } from "@/db/repositories/settingsRepo";
import { BillDetail } from "@/db/repositories/billsRepo";
import { Customer } from "@/db/repositories/customersRepo";
import { LedgerItem } from "@/services/balance";

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildBillHtml(bill: BillDetail, language: "en" | "ta" = "en"): string {
  const millName = escapeHtml(settingsRepo.get("mill_name", "Cattle Feed Mill"));
  const millPhone = escapeHtml(settingsRepo.get("mill_phone", ""));
  const isTa = language === "ta";

  const labels = {
    title: millName,
    subtitle: millPhone ? (isTa ? `தொலைபேசி: ${millPhone}` : `Phone: ${millPhone}`) : (isTa ? "சில்லறை கடன் கணக்கு புத்தகம்" : "Retail Credit Ledger"),
    billTo: isTa ? "வாடிக்கையாளர்" : "Bill To",
    walkIn: isTa ? "ரொக்க விற்பனை" : "Cash Walk-in",
    billNo: isTa ? "ரசீது எண்" : "Bill No",
    date: isTa ? "தேதி" : "Date",
    type: isTa ? "வகை" : "Type",
    item: isTa ? "பொருள்" : "Item",
    qty: isTa ? "அளவு" : "Qty",
    rate: isTa ? "விலை" : "Rate",
    amount: isTa ? "தொகை" : "Amount",
    grandTotal: isTa ? "மொத்த தொகை" : "Grand Total",
  };

  const itemsHtml = bill.items
    .map((it) => {
      const displayName = isTa && it.product_name_ta ? `${it.product_name_ta} (${it.product_name})` : it.product_name;
      return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(displayName)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${it.qty} ${escapeHtml(it.unit)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatINR(it.price_paise)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${formatINR(it.amount_paise)}</td>
      </tr>`;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: sans-serif; margin: 24px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 24px; font-weight: bold; color: #15803d; margin: 0; }
          .contact { font-size: 13px; color: #64748b; margin-top: 4px; }
          .bill-info { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
          th { background-color: #f1f5f9; padding: 8px; text-align: left; font-weight: bold; border-bottom: 2px solid #cbd5e1; }
          .total-row { font-size: 18px; font-weight: bold; text-align: right; padding-top: 14px; color: #0f172a; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">${labels.title}</h1>
          <div class="contact">${labels.subtitle}</div>
        </div>

        <div class="bill-info">
          <div>
            <strong>${labels.billTo}:</strong> ${escapeHtml(bill.customer_name) || labels.walkIn}<br />
            ${bill.customer_phone ? `Phone: ${escapeHtml(bill.customer_phone)}<br />` : ""}
          </div>
          <div style="text-align: right;">
            <strong>${labels.billNo}:</strong> #${bill.bill_no}<br />
            <strong>${labels.date}:</strong> ${formatDate(bill.bill_date)}<br />
            <strong>${labels.type}:</strong> ${bill.type.toUpperCase()}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${labels.item}</th>
              <th style="text-align: center;">${labels.qty}</th>
              <th style="text-align: right;">${labels.rate}</th>
              <th style="text-align: right;">${labels.amount}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="total-row">
          ${labels.grandTotal}: ${formatINR(bill.total_paise)}
        </div>
      </body>
    </html>
  `;
}

export function buildStatementHtml(
  customer: Customer,
  ledger: LedgerItem[],
  finalBalancePaise: number,
  language: "en" | "ta" = "en"
): string {
  const millName = escapeHtml(settingsRepo.get("mill_name", "Cattle Feed Mill"));
  const millPhone = escapeHtml(settingsRepo.get("mill_phone", ""));
  const isTa = language === "ta";

  const labels = {
    title: millName,
    subtitle: isTa ? `வாடிக்கையாளர் கணக்கு அறிக்கை ${millPhone ? `• ${millPhone}` : ""}` : `Customer Ledger Statement ${millPhone ? `• Phone: ${millPhone}` : ""}`,
    customer: isTa ? "வாடிக்கையாளர்" : "Customer",
    statementDate: isTa ? "அறிக்கை தேதி" : "Statement Date",
    date: isTa ? "தேதி" : "Date",
    particulars: isTa ? "விபரம்" : "Particulars",
    debit: isTa ? "பற்று (ரசீது)" : "Debit (Bill)",
    credit: isTa ? "வரவு (பணம்)" : "Credit (Payment)",
    runningBalance: isTa ? "நிலுவை" : "Running Balance",
    closingBalance: isTa ? "இறுதி நிலுவை தொகை" : "Closing Pending Balance",
    bill: isTa ? "ரசீது" : "Bill",
    payment: isTa ? "வரவு" : "Payment",
  };

  const rowsHtml = ledger
    .map(
      (row) => `
      <tr style="${row.status === "cancelled" ? "text-decoration: line-through; color: #94a3b8;" : ""}">
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${formatDate(row.date)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
          ${row.kind === "bill" ? `${labels.bill} #${row.ref_no}` : `${labels.payment} (${escapeHtml(row.mode)})`}
          ${row.note ? `<br/><small style="color: #64748b;">${escapeHtml(row.note)}</small>` : ""}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; color: ${row.kind === "bill" ? "#b45309" : "#1e293b"};">
          ${row.kind === "bill" ? formatINR(row.amount_paise) : "-"}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; color: ${row.kind === "payment" ? "#047857" : "#1e293b"}; font-weight: bold;">
          ${row.kind === "payment" ? formatINR(row.amount_paise) : "-"}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: ${row.running_balance_paise > 0 ? "#dc2626" : "#2563eb"};">
          ${formatINR(row.running_balance_paise)}
        </td>
      </tr>`
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: sans-serif; margin: 24px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 24px; font-weight: bold; color: #15803d; margin: 0; }
          .sub { font-size: 14px; color: #64748b; margin-top: 4px; }
          .cust { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
          th { background-color: #f1f5f9; padding: 8px; text-align: left; font-weight: bold; border-bottom: 2px solid #cbd5e1; }
          .summary { margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 8px; text-align: right; font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">${labels.title}</h1>
          <div class="sub">${labels.subtitle}</div>
        </div>

        <div class="cust">
          <div>
            <strong>${labels.customer}:</strong> ${escapeHtml(customer.name)}<br />
            ${customer.phone ? `Phone: ${escapeHtml(customer.phone)}<br />` : ""}
            ${customer.village ? `Village: ${escapeHtml(customer.village)}` : ""}
          </div>
          <div style="text-align: right;">
            <strong>${labels.statementDate}:</strong> ${formatDate(new Date())}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${labels.date}</th>
              <th>${labels.particulars}</th>
              <th style="text-align: right;">${labels.debit}</th>
              <th style="text-align: right;">${labels.credit}</th>
              <th style="text-align: right;">${labels.runningBalance}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="summary">
          <strong>${labels.closingBalance}:</strong>
          <span style="color: ${finalBalancePaise > 0 ? "#dc2626" : "#2563eb"}; font-weight: bold; font-size: 20px; margin-left: 8px;">
            ${formatINR(finalBalancePaise)}
          </span>
        </div>
      </body>
    </html>
  `;
}

export const pdfService = {
  async generateAndShareBillPdf(bill: BillDetail): Promise<void> {
    const lang = (settingsRepo.get("language", "en") as "en" | "ta") || "en";
    const html = buildBillHtml(bill, lang);
    const { uri } = await Print.printToFileAsync({ html });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf" });
    } else {
      Alert.alert("PDF Generated", `Saved PDF to: ${uri}`);
    }
  },

  async printBillDirect(bill: BillDetail): Promise<void> {
    const lang = (settingsRepo.get("language", "en") as "en" | "ta") || "en";
    const html = buildBillHtml(bill, lang);
    await Print.printAsync({ html });
  },

  async generateAndShareCustomerStatement(
    customer: Customer,
    ledger: LedgerItem[],
    finalBalancePaise: number
  ): Promise<void> {
    const lang = (settingsRepo.get("language", "en") as "en" | "ta") || "en";
    const html = buildStatementHtml(customer, ledger, finalBalancePaise, lang);
    const { uri } = await Print.printToFileAsync({ html });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf" });
    } else {
      Alert.alert("Statement Generated", `Saved PDF to: ${uri}`);
    }
  },
};
