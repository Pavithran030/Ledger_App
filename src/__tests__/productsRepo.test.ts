import { productsRepo } from "../db/repositories/productsRepo";
import { pricesRepo } from "../db/repositories/pricesRepo";
import { setDb } from "../db/client";
import { createMockDatabase, MockDatabase } from "./testDb";

describe("Products Repository — Atomic Creation, Prices & Stock Adjustments", () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDatabase();
    setDb(mockDb);
  });

  afterAll(() => {
    setDb(null);
  });

  it("atomically creates a product with opening stock, price history, and stock move", () => {
    const product = productsRepo.createWithPrice(
      {
        name: "Cattle Feed Pellets",
        name_ta: "கால்நடை தீவன கிரானூல்ஸ்",
        unit: "bag",
        opening_stock: 40,
        low_stock_alert: 10,
      },
      175000 // ₹1,750 (175,000 paise)
    );

    expect(product.id).toBeDefined();
    expect(product.name).toBe("Cattle Feed Pellets");
    expect(product.name_ta).toBe("கால்நடை தீவன கிரானூல்ஸ்");
    expect(product.stock_qty).toBe(40);
    expect(product.current_price_paise).toBe(175000);

    // Verify price history was inserted
    const currentPrice = pricesRepo.getCurrentPrice(product.id);
    expect(currentPrice).toBe(175000);

    // Verify stock move was recorded for opening stock
    const dbInstance = mockDb as MockDatabase;
    const move = dbInstance.stock_moves.find((m) => m.product_id === product.id);
    expect(move).toBeDefined();
    expect(move!.qty_change).toBe(40);
    expect(move!.reason).toBe("opening_stock");
  });

  it("adjusts stock up and logs a stock_move with custom reason", () => {
    const product = productsRepo.createWithPrice(
      {
        name: "Groundnut Cake",
        unit: "bag",
        opening_stock: 15,
      },
      80000
    );

    // Add +25 bags arrived from distributor
    productsRepo.adjustStock(product.id, 25, "New consignment received");

    const updated = productsRepo.getById(product.id);
    expect(updated).not.toBeNull();
    expect(updated!.stock_qty).toBe(40);

    const dbInstance = mockDb as MockDatabase;
    const moves = dbInstance.stock_moves.filter((m) => m.product_id === product.id);
    expect(moves.length).toBe(2); // 1 opening stock + 1 adjustment
    expect(moves[1].qty_change).toBe(25);
    expect(moves[1].reason).toBe("New consignment received");
  });

  it("adjusts stock down for damaged bags and logs the move", () => {
    const product = productsRepo.createWithPrice(
      {
        name: "Mineral Mixture",
        unit: "packet",
        opening_stock: 50,
      },
      45000
    );

    // Reduce by 3 damaged packets
    productsRepo.adjustStock(product.id, -3, "Water damage in godown");

    const updated = productsRepo.getById(product.id);
    expect(updated!.stock_qty).toBe(47);

    const dbInstance = mockDb as MockDatabase;
    const move = dbInstance.stock_moves.find(
      (m) => m.product_id === product.id && m.qty_change === -3
    );
    expect(move).toBeDefined();
    expect(move!.reason).toBe("Water damage in godown");
  });

  it("lists products with current prices accurately", () => {
    productsRepo.createWithPrice(
      { name: "Dairy Cattle Feed", unit: "bag", opening_stock: 20 },
      145000
    );
    productsRepo.createWithPrice(
      { name: "Calcium Supplement", unit: "kg", opening_stock: 100 },
      8500
    );

    const list = productsRepo.listWithCurrentPrices("active");
    expect(list.length).toBe(2);

    const complex = list.find((p) => p.name.includes("Dairy"));
    expect(complex).toBeDefined();
    expect(complex!.current_price_paise).toBe(145000);

    const zinc = list.find((p) => p.name.includes("Calcium"));
    expect(zinc).toBeDefined();
    expect(zinc!.current_price_paise).toBe(8500);
  });
});
