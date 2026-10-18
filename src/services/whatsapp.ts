import { Linking, Alert } from "react-native";
import { formatINR, paiseToRupees } from "@/utils/money";
import { formatDate } from "@/utils/dates";
import { settingsRepo } from "@/db/repositories/settingsRepo";
import { BillDetail } from "@/db/repositories/billsRepo";

export interface WhatsAppBalanceOptions {
  customerName: string;
  phone: string;
  balancePaise: number;
  recentBills?: Array<{ date: string; bill_no: number; amount_paise: number }>;
  recentPayments?: Array<{ date: string; amount_paise: number; mode: string }>;
  language?: "en" | "ta";
}

export interface WhatsAppPaymentReceiptOptions {
  customerName: string;
  phone: string;
  paidAmountPaise: number;
  remainingBalancePaise: number;
  payDate: string;
  mode: string;
  language?: "en" | "ta";
}

export function buildBalanceMessage(options: WhatsAppBalanceOptions): string {
  const {
    customerName,
    balancePaise,
    recentBills = [],
    recentPayments = [],
    language = "en",
  } = options;

  const millName = settingsRepo.get("mill_name", "Cattle Feed Mill");
  const formattedBalance = formatINR(balancePaise);

  if (language === "ta") {
    let msg = `வணக்கம் ${customerName},\n${millName}-ல் உங்கள் மீதமுள்ள பாக்கித் தொகை: ${formattedBalance}\n`;

    if (recentBills.length > 0) {
      msg += `\nசமீபத்திய பில்கள்:\n`;
      for (const b of recentBills) {
        msg += `${formatDate(b.date)} - பில் #${b.bill_no} - ${formatINR(b.amount_paise)}\n`;
      }
    }

    if (recentPayments.length > 0) {
      msg += `\nசமீபத்திய வரவுகள்:\n`;
      for (const p of recentPayments) {
        msg += `${formatDate(p.date)} - ${formatINR(p.amount_paise)} (${p.mode})\n`;
      }
    }

    msg += `\nநன்றி.\n${millName}`;
    return msg;
  }

  // English
  let msg = `Hello ${customerName},\nYour pending amount at ${millName}: ${formattedBalance}\n`;

  if (recentBills.length > 0) {
    msg += `\nRecent bills:\n`;
    for (const b of recentBills) {
      msg += `${formatDate(b.date)} - Bill #${b.bill_no} - ${formatINR(b.amount_paise)}\n`;
    }
  }

  if (recentPayments.length > 0) {
    msg += `\nRecent payments:\n`;
    for (const p of recentPayments) {
      msg += `${formatDate(p.date)} - ${formatINR(p.amount_paise)} (${p.mode})\n`;
    }
  }

  msg += `\nThank you.\n${millName}`;
  return msg;
}

export function buildPaymentReceiptMessage(options: WhatsAppPaymentReceiptOptions): string {
  const {
    customerName,
    paidAmountPaise,
    remainingBalancePaise,
    payDate,
    language = "en",
  } = options;

  const millName = settingsRepo.get("mill_name", "Cattle Feed Mill");
  const formattedPaid = formatINR(paidAmountPaise);
  const formattedRemaining = formatINR(remainingBalancePaise);
  const formattedDate = formatDate(payDate);

  if (language === "ta") {
    return `வணக்கம் ${customerName}, ${formattedDate} அன்று ${formattedPaid} வரவு பெறப்பட்டது. உங்கள் தற்போதைய மீதி பாக்கி: ${formattedRemaining}. நன்றி. - ${millName}`;
  }

  return `Hello ${customerName}, we received ${formattedPaid} on ${formattedDate}. Your balance is now ${formattedRemaining}. Thank you. - ${millName}`;
}

export function buildBillReceiptMessage(bill: BillDetail, language = "en"): string {
  const millName = settingsRepo.get("mill_name", "Cattle Feed Mill");
  const total = formatINR(bill.total_paise);
  const date = formatDate(bill.bill_date);

  if (language === "ta") {
    let msg = `வணக்கம் ${bill.customer_name || ""},\n${millName}-ல் உங்கள் பில் #${bill.bill_no} (${date}):\n\n`;
    for (const it of bill.items) {
      msg += `• ${it.product_name_ta || it.product_name}: ${it.qty} ${it.unit}s - ${formatINR(it.amount_paise)}\n`;
    }
    msg += `\nமொத்தத் தொகை: ${total}\n`;
    if (bill.due_date) {
      msg += `கடைசித் தேதி: ${formatDate(bill.due_date)}\n`;
    }
    msg += `நன்றி! - ${millName}`;
    return msg;
  }

  let msg = `Hello ${bill.customer_name || ""},\nYour Bill #${bill.bill_no} on ${date} at ${millName}:\n\n`;
  for (const it of bill.items) {
    msg += `• ${it.product_name}: ${it.qty} ${it.unit}s - ${formatINR(it.amount_paise)}\n`;
  }
  msg += `\nTotal Amount: ${total}\n`;
  if (bill.due_date) {
    msg += `Due Date: ${formatDate(bill.due_date)}\n`;
  }
  msg += `Thank you! - ${millName}`;
  return msg;
}

export function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }
  return digits;
}

export const whatsappService = {
  async openWhatsApp(phone: string, message: string): Promise<boolean> {
    try {
      const normalizedPhone = normalizeWhatsAppPhone(phone);
      if (!normalizedPhone) {
        Alert.alert("Invalid Phone", "Please provide a valid phone number.");
        return false;
      }
      const url = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
      await Linking.openURL(url);
      return true;
    } catch {
      Alert.alert(
        "WhatsApp Error",
        "Could not launch WhatsApp. Please check if WhatsApp is installed on this device."
      );
      return false;
    }
  },

  async sendBalance(options: WhatsAppBalanceOptions): Promise<boolean> {
    const lang = options.language || (settingsRepo.get("language", "en") as "en" | "ta") || "en";
    const msg = buildBalanceMessage({ ...options, language: lang });
    return this.openWhatsApp(options.phone, msg);
  },

  async sendPaymentReceipt(options: WhatsAppPaymentReceiptOptions): Promise<boolean> {
    const lang = options.language || (settingsRepo.get("language", "en") as "en" | "ta") || "en";
    const msg = buildPaymentReceiptMessage({ ...options, language: lang });
    return this.openWhatsApp(options.phone, msg);
  },

  async sendBillReceipt(bill: BillDetail): Promise<boolean> {
    if (!bill.customer_phone) return false;
    const lang = (settingsRepo.get("language", "en") as "en" | "ta") || "en";
    const msg = buildBillReceiptMessage(bill, lang);
    return this.openWhatsApp(bill.customer_phone, msg);
  },
};
