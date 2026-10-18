import { balanceService } from "../services/balance";
import { billsRepo } from "../db/repositories/billsRepo";
import { paymentsRepo } from "../db/repositories/paymentsRepo";
import { customersRepo } from "../db/repositories/customersRepo";
import { productsRepo } from "../db/repositories/productsRepo";
import { setDb } from "../db/client";
import { createMockDatabase } from "./testDb";

describe("Balance Service & Customer Ledger", () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDatabase();
    setDb(mockDb);
  });

  afterAll(() => {
    setDb(null);
  });

  it("proves part-payment reduces balance accurately", () => {
    const customer = customersRepo.create({ name: "Ramasamy", phone: "919876543210" });
    const product = productsRepo.create({ name: "Mineral Mixture", unit: "bag", opening_stock: 100 });

    // Initial balance should be 0
    expect(balanceService.getCustomerBalance(customer.id)).toBe(0);

    // Credit sale of ₹6,000 (600,000 paise)
    billsRepo.createBill({
      customer_id: customer.id,
      type: "credit",
      bill_date: "2026-03-01",
      items: [{ product_id: product.id, qty: 5, price_paise: 120000 }],
    });

    expect(balanceService.getCustomerBalance(customer.id)).toBe(600000);

    // Part-payment of ₹2,500 (250,000 paise)
    paymentsRepo.addPayment({
      customer_id: customer.id,
      amount_paise: 250000,
      pay_date: "2026-03-05",
      mode: "cash",
    });

    // Balance should now be ₹3,500 (350,000 paise)
    expect(balanceService.getCustomerBalance(customer.id)).toBe(350000);
  });

  it("proves multiple payments accumulate and overpayment gives negative balance (advance)", () => {
    const customer = customersRepo.create({ name: "Kannan", phone: "919876543211" });
    const product = productsRepo.create({ name: "Cattle Feed Pellets", unit: "bag", opening_stock: 50 });

    // Credit bill of ₹5,700 (570,000 paise)
    billsRepo.createBill({
      customer_id: customer.id,
      type: "credit",
      bill_date: "2026-03-01",
      items: [{ product_id: product.id, qty: 2, price_paise: 285000 }],
    });

    expect(balanceService.getCustomerBalance(customer.id)).toBe(570000);

    // First payment: ₹3,000
    paymentsRepo.addPayment({
      customer_id: customer.id,
      amount_paise: 300000,
      pay_date: "2026-03-05",
      mode: "upi",
    });
    expect(balanceService.getCustomerBalance(customer.id)).toBe(270000);

    // Second payment: ₹3,000 (Overpayment by ₹300)
    paymentsRepo.addPayment({
      customer_id: customer.id,
      amount_paise: 300000,
      pay_date: "2026-03-10",
      mode: "cash",
    });

    // Customer now has advance of ₹300 (-30,000 paise)
    expect(balanceService.getCustomerBalance(customer.id)).toBe(-30000);
  });

  it("proves cancelled bills and cancelled payments are excluded from balance", () => {
    const customer = customersRepo.create({ name: "Selvam", phone: "919876543212" });
    const product = productsRepo.create({ name: "Calf Starter Feed", unit: "packet", opening_stock: 100 });

    // Bill 1: ₹1,000
    const bill1 = billsRepo.createBill({
      customer_id: customer.id,
      type: "credit",
      bill_date: "2026-03-01",
      items: [{ product_id: product.id, qty: 10, price_paise: 10000 }],
    });

    // Bill 2: ₹2,000
    const bill2 = billsRepo.createBill({
      customer_id: customer.id,
      type: "credit",
      bill_date: "2026-03-02",
      items: [{ product_id: product.id, qty: 20, price_paise: 10000 }],
    });

    // Payment: ₹1,500
    const payment = paymentsRepo.addPayment({
      customer_id: customer.id,
      amount_paise: 150000,
      pay_date: "2026-03-03",
    });

    // Active balance: (100,000 + 200,000) - 150,000 = 150,000 paise (₹1,500)
    expect(balanceService.getCustomerBalance(customer.id)).toBe(150000);

    // Cancel payment
    paymentsRepo.cancelPayment(payment.id);
    // Balance becomes 300,000 paise (₹3,000)
    expect(balanceService.getCustomerBalance(customer.id)).toBe(300000);

    // Cancel Bill 2
    billsRepo.cancelBill(bill2.id);
    // Balance becomes 100,000 paise (₹1,000)
    expect(balanceService.getCustomerBalance(customer.id)).toBe(100000);
  });

  it("proves chronological running balance in customer ledger", () => {
    const customer = customersRepo.create({ name: "Mani", phone: "919876543213" });
    const product = productsRepo.create({ name: "Molasses Mix", unit: "litre", opening_stock: 50 });

    // 1. Bill on Mar 1: ₹1,000 (running: 1,000)
    billsRepo.createBill({
      customer_id: customer.id,
      type: "credit",
      bill_date: "2026-03-01",
      items: [{ product_id: product.id, qty: 2, price_paise: 50000 }],
    });

    // 2. Bill on Mar 5: ₹2,000 (running: 3,000)
    billsRepo.createBill({
      customer_id: customer.id,
      type: "credit",
      bill_date: "2026-03-05",
      items: [{ product_id: product.id, qty: 4, price_paise: 50000 }],
    });

    // 3. Payment on Mar 10: ₹1,500 (running: 1,500)
    paymentsRepo.addPayment({
      customer_id: customer.id,
      amount_paise: 150000,
      pay_date: "2026-03-10",
      mode: "upi",
    });

    const ledger = balanceService.getLedger(customer.id);
    expect(ledger.length).toBe(3);

    expect(ledger[0].running_balance_paise).toBe(100000);
    expect(ledger[1].running_balance_paise).toBe(300000);
    expect(ledger[2].running_balance_paise).toBe(150000);
  });
});
