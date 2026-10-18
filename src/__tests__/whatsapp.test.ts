import {
  buildBalanceMessage,
  buildPaymentReceiptMessage,
  buildBillReceiptMessage,
} from "../services/whatsapp";
import { setDb } from "../db/client";
import { createMockDatabase } from "./testDb";
import { settingsRepo } from "../db/repositories/settingsRepo";

describe("WhatsApp Service & Message Builders", () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDatabase();
    setDb(mockDb);
    settingsRepo.set("mill_name", "Sri Murugan Agro");
  });

  afterAll(() => {
    setDb(null);
  });

  it("builds English balance message correctly with recent bills and payments", () => {
    const msg = buildBalanceMessage({
      customerName: "Murugan",
      phone: "919876543210",
      balancePaise: 870000,
      recentBills: [{ date: "2026-03-01", bill_no: 101, amount_paise: 600000 }],
      recentPayments: [{ date: "2026-03-05", amount_paise: 300000, mode: "UPI" }],
      language: "en",
    });

    expect(msg).toContain("Hello Murugan");
    expect(msg).toContain("Sri Murugan Agro");
    expect(msg).toContain("₹8,700");
    expect(msg).toContain("Bill #101");
    expect(msg).toContain("₹6,000");
    expect(msg).toContain("₹3,000 (UPI)");
  });

  it("builds Tamil balance message correctly with Tamil characters", () => {
    const msg = buildBalanceMessage({
      customerName: "முருகன்",
      phone: "919876543210",
      balancePaise: 870000,
      recentBills: [{ date: "2026-03-01", bill_no: 101, amount_paise: 600000 }],
      recentPayments: [{ date: "2026-03-05", amount_paise: 300000, mode: "ரொக்கம்" }],
      language: "ta",
    });

    expect(msg).toContain("வணக்கம் முருகன்");
    expect(msg).toContain("மீதமுள்ள பாக்கித் தொகை: ₹8,700");
    expect(msg).toContain("பில் #101");
    expect(msg).toContain("நன்றி.");
  });

  it("builds payment receipt message in English and Tamil", () => {
    const enReceipt = buildPaymentReceiptMessage({
      customerName: "Murugan",
      phone: "919876543210",
      paidAmountPaise: 300000,
      remainingBalancePaise: 570000,
      payDate: "2026-03-05",
      mode: "UPI",
      language: "en",
    });

    expect(enReceipt).toContain("received ₹3,000");
    expect(enReceipt).toContain("balance is now ₹5,700");

    const taReceipt = buildPaymentReceiptMessage({
      customerName: "முருகன்",
      phone: "919876543210",
      paidAmountPaise: 300000,
      remainingBalancePaise: 570000,
      payDate: "2026-03-05",
      mode: "UPI",
      language: "ta",
    });

    expect(taReceipt).toContain("₹3,000 வரவு பெறப்பட்டது");
    expect(taReceipt).toContain("மீதி பாக்கி: ₹5,700");
  });

  it("builds bill receipt message correctly", () => {
    const msg = buildBillReceiptMessage(
      {
        id: "b1",
        bill_no: 42,
        customer_id: "c1",
        customer_name: "Selvam",
        customer_phone: "919876543210",
        type: "credit",
        bill_date: "2026-03-01",
        due_date: "2026-04-01",
        total_paise: 350000,
        note: null,
        status: "active",
        created_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-03-01T00:00:00Z",
        synced_at: null,
        items: [
          {
            id: "i1",
            bill_id: "b1",
            product_id: "p1",
            qty: 2,
            price_paise: 175000,
            amount_paise: 350000,
            synced_at: null,
            product_name: "Cattle Feed Pellets",
            product_name_ta: "கால்நடை தீவன கிரானூல்ஸ்",
            unit: "bag",
          },
        ],
      },
      "en"
    );

    expect(msg).toContain("Bill #42");
    expect(msg).toContain("Cattle Feed Pellets: 2 bags - ₹3,500");
    expect(msg).toContain("Total Amount: ₹3,500");
  });

  it("normalizes Indian phone numbers correctly for WhatsApp links", () => {
    const { normalizeWhatsAppPhone } = require("../services/whatsapp");
    expect(normalizeWhatsAppPhone("9876543210")).toBe("919876543210");
    expect(normalizeWhatsAppPhone("09876543210")).toBe("919876543210");
    expect(normalizeWhatsAppPhone("+91 98765 43210")).toBe("919876543210");
    expect(normalizeWhatsAppPhone("919876543210")).toBe("919876543210");
  });
});
