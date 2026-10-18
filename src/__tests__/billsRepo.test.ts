import { billsRepo } from "../db/repositories/billsRepo";
import { productsRepo } from "../db/repositories/productsRepo";
import { pricesRepo } from "../db/repositories/pricesRepo";
import { customersRepo } from "../db/repositories/customersRepo";
import { balanceService } from "../services/balance";
import { setDb } from "../db/client";
import { createMockDatabase } from "./testDb";

describe("Bills Repository — Sales, Price Lock & Stock Transactions", () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDatabase();
    setDb(mockDb);
  });

  afterAll(() => {
    setDb(null);
  });

  it("proves changing a product price after a sale does NOT change the old bill item (Price Lock)", () => {
    // 1. Create product 'Cattle Feed Pellets' with opening stock of 50 bags
    const product = productsRepo.create({
      name: "Cattle Feed Pellets",
      unit: "bag",
      opening_stock: 50,
    });

    // 2. Add initial price: ₹1,200 (120,000 paise)
    pricesRepo.addPrice(product.id, 120000, "2026-01-01T00:00:00.000Z");

    // 3. Create customer Murugan
    const customer = customersRepo.create({
      name: "Murugan",
      phone: "919876543210",
    });

    // 4. Create credit sale of 5 bags at current price ₹1,200
    const bill = billsRepo.createBill({
      customer_id: customer.id,
      type: "credit",
      items: [
        {
          product_id: product.id,
          qty: 5,
          price_paise: 120000,
        },
      ],
    });

    // Bill total should be 5 * 120,000 = 600,000 paise (₹6,000)
    expect(bill.total_paise).toBe(600000);
    expect(bill.items[0].price_paise).toBe(120000);

    // 5. Product price is updated later to ₹1,350 (135,000 paise)
    pricesRepo.addPrice(product.id, 135000, "2026-02-01T00:00:00.000Z");

    // Current price is now ₹1,350
    const newPrice = pricesRepo.getCurrentPrice(product.id, "2026-02-15T00:00:00.000Z");
    expect(newPrice).toBe(135000);

    // 6. Verify the old bill item STILL retains ₹1,200 locked price
    const savedBill = billsRepo.getById(bill.id);
    expect(savedBill).not.toBeNull();
    expect(savedBill!.items[0].price_paise).toBe(120000);
    expect(savedBill!.total_paise).toBe(600000);
  });

  it("proves cancelling a bill restores stock and logs reversing stock moves", () => {
    const product = productsRepo.create({
      name: "Dairy Feed Mix",
      unit: "bag",
      opening_stock: 30,
    });

    // Stock starts at 30
    expect(productsRepo.getById(product.id)!.stock_qty).toBe(30);

    // Sell 10 bags
    const bill = billsRepo.createBill({
      customer_id: null,
      type: "cash",
      items: [
        {
          product_id: product.id,
          qty: 10,
          price_paise: 180000,
        },
      ],
    });

    // Stock should be 20
    expect(productsRepo.getById(product.id)!.stock_qty).toBe(20);

    // Cancel the bill
    const cancelled = billsRepo.cancelBill(bill.id);
    expect(cancelled).toBe(true);

    // Stock should be restored to 30
    expect(productsRepo.getById(product.id)!.stock_qty).toBe(30);

    // Bill status should be 'cancelled'
    const fetched = billsRepo.getById(bill.id);
    expect(fetched!.status).toBe("cancelled");
  });

  it("proves totals use integer paise rounding correctly with decimal quantities", () => {
    const product = productsRepo.create({
      name: "Feed Supplement",
      unit: "litre",
      opening_stock: 100,
    });

    // 2.5 litres at ₹350.50 (35,050 paise) = round(2.5 * 35050) = round(87625) = 87,625 paise (₹876.25)
    const bill = billsRepo.createBill({
      customer_id: null,
      type: "cash",
      items: [
        {
          product_id: product.id,
          qty: 2.5,
          price_paise: 35050,
        },
      ],
    });

    expect(Number.isInteger(bill.total_paise)).toBe(true);
    expect(bill.total_paise).toBe(87625);
  });

  it("creates an opening balance bill for a customer with credit type and integer paise", () => {
    const customer = customersRepo.create({
      name: "Ramasamy",
      phone: "919443322110",
      village: "Kallakurichi",
    });

    const openingBill = billsRepo.createOpeningBalanceBill(
      customer.id,
      500000, // ₹5,000 opening credit balance
      "Past dues carried forward"
    );

    expect(openingBill).toBeDefined();
    expect(openingBill.type).toBe("credit");
    expect(openingBill.customer_id).toBe(customer.id);
    expect(openingBill.total_paise).toBe(500000);
    expect(openingBill.note).toBe("Past dues carried forward");
    expect(openingBill.status).toBe("active");
    expect(openingBill.bill_no).toBeGreaterThanOrEqual(1);

    const retrieved = billsRepo.getById(openingBill.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.customer_name).toBe("Ramasamy");
    expect(retrieved!.total_paise).toBe(500000);
  });

  it("records money received at sale time as a payment in the same transaction", () => {
    const product = productsRepo.create({
      name: "Cattle Feed Pellets",
      unit: "bag",
      opening_stock: 20,
    });

    const customer = customersRepo.create({
      name: "Selvam",
      phone: "919800000000",
    });

    // Existing notebook balance: ₹1,000
    billsRepo.createOpeningBalanceBill(customer.id, 100000, "Opening Balance");

    // Regular customer buys ₹2,000 worth and hands over ₹2,000 now.
    const bill = billsRepo.createBill({
      customer_id: customer.id,
      type: "credit",
      items: [{ product_id: product.id, qty: 2, price_paise: 100000 }],
      payment: { amount_paise: 200000, mode: "cash" },
    });

    expect(bill.total_paise).toBe(200000);
    // Stock reduced by 2 bags
    expect(productsRepo.getById(product.id)!.stock_qty).toBe(18);

    // Balance = opening ₹1,000 + sale ₹2,000 − paid ₹2,000 = ₹1,000
    expect(balanceService.getCustomerBalance(customer.id)).toBe(100000);
    expect(mockDb.payments).toHaveLength(1);
    expect(mockDb.payments[0].amount_paise).toBe(200000);
  });

  it("leaves the full amount as credit when nothing is received at sale time", () => {
    const product = productsRepo.create({
      name: "Dairy Feed Mix",
      unit: "bag",
      opening_stock: 10,
    });
    const customer = customersRepo.create({ name: "Kannan", phone: "919800000001" });

    billsRepo.createBill({
      customer_id: customer.id,
      type: "credit",
      items: [{ product_id: product.id, qty: 1, price_paise: 150000 }],
      payment: { amount_paise: 0, mode: "cash" },
    });

    expect(balanceService.getCustomerBalance(customer.id)).toBe(150000);
    expect(mockDb.payments).toHaveLength(0);
  });
});
