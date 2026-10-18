import { pricesRepo } from "../db/repositories/pricesRepo";
import { runMigrations } from "../db/migrations";
import { setDb } from "../db/client";
import { createMockDatabase } from "./testDb";
import { resolveEffectivePrice } from "../services/pricing";

describe("Prices Repository & Historical Pricing", () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDatabase();
    setDb(mockDb);
    runMigrations(mockDb);
  });

  afterAll(() => {
    setDb(null);
  });

  it("adds and retrieves current price correctly", () => {
    const productId = "prod-test-1";
    pricesRepo.addPrice(productId, 120000, "2026-01-01T00:00:00.000Z");

    const price = pricesRepo.getCurrentPrice(productId, "2026-01-15T00:00:00.000Z");
    expect(price).toBe(120000);
  });

  it("returns the appropriate historical price based on effective date", () => {
    const productId = "prod-urea-time";

    // Original price on Jan 1: ₹1,200 (120,000 paise)
    pricesRepo.addPrice(productId, 120000, "2026-01-01T00:00:00.000Z");

    // Price revision on Feb 1: ₹1,350 (135,000 paise)
    pricesRepo.addPrice(productId, 135000, "2026-02-01T00:00:00.000Z");

    // Price revision on March 1: ₹1,400 (140,000 paise)
    pricesRepo.addPrice(productId, 140000, "2026-03-01T00:00:00.000Z");

    // Check price as of mid-January -> should be ₹1,200
    expect(pricesRepo.getCurrentPrice(productId, "2026-01-15T12:00:00.000Z")).toBe(120000);

    // Check price as of mid-February -> should be ₹1,350
    expect(pricesRepo.getCurrentPrice(productId, "2026-02-15T12:00:00.000Z")).toBe(135000);

    // Check price as of mid-March (after March 1) -> should be ₹1,400
    expect(pricesRepo.getCurrentPrice(productId, "2026-03-15T12:00:00.000Z")).toBe(140000);

    // Check price before Jan 1 -> should be null
    expect(pricesRepo.getCurrentPrice(productId, "2025-12-31T23:59:59.000Z")).toBeNull();
  });

  it("pure resolveEffectivePrice resolves correctly across edge dates", () => {
    const history = [
      { product_id: "p1", price_paise: 10000, effective_from: "2026-01-01T00:00:00.000Z", created_at: "2026-01-01T00:00:00.000Z" },
      { product_id: "p1", price_paise: 12000, effective_from: "2026-02-01T00:00:00.000Z", created_at: "2026-02-01T00:00:00.000Z" },
    ];

    expect(resolveEffectivePrice(history, "2025-12-31T00:00:00.000Z")).toBeNull();
    expect(resolveEffectivePrice(history, "2026-01-01T00:00:00.000Z")).toBe(10000);
    expect(resolveEffectivePrice(history, "2026-01-31T23:59:59.000Z")).toBe(10000);
    expect(resolveEffectivePrice(history, "2026-02-01T00:00:00.000Z")).toBe(12000);
    expect(resolveEffectivePrice(history, "2026-05-01T00:00:00.000Z")).toBe(12000);
  });
});
