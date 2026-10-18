import {
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  calculateLineAmountPaise,
} from "../utils/money";

describe("Money Utilities (Integer Paise Math)", () => {
  describe("rupeesToPaise", () => {
    it("converts integer rupees to paise", () => {
      expect(rupeesToPaise(100)).toBe(10000);
      expect(rupeesToPaise(0)).toBe(0);
      expect(rupeesToPaise(1250)).toBe(125000);
    });

    it("converts decimal rupees to integer paise without floating point error", () => {
      expect(rupeesToPaise(1200.5)).toBe(120050);
      expect(rupeesToPaise(19.99)).toBe(1999);
      expect(rupeesToPaise(0.05)).toBe(5);
    });

    it("handles string input and cleans commas", () => {
      expect(rupeesToPaise("1,250")).toBe(125000);
      expect(rupeesToPaise(" 1,200.75 ")).toBe(120075);
      expect(rupeesToPaise("")).toBe(0);
      expect(rupeesToPaise("invalid")).toBe(0);
    });
  });

  describe("paiseToRupees", () => {
    it("converts paise to exact rupees", () => {
      expect(paiseToRupees(10000)).toBe(100);
      expect(paiseToRupees(120050)).toBe(1200.5);
      expect(paiseToRupees(1999)).toBe(19.99);
      expect(paiseToRupees(0)).toBe(0);
    });
  });

  describe("formatINR", () => {
    it("formats amounts in Indian numbering format", () => {
      expect(formatINR(12500000)).toBe("₹1,25,000");
      expect(formatINR(10000000)).toBe("₹1,00,000");
      expect(formatINR(50000)).toBe("₹500");
      expect(formatINR(0)).toBe("₹0");
    });

    it("includes paise when non-zero", () => {
      expect(formatINR(12500050)).toBe("₹1,25,000.50");
      expect(formatINR(1005)).toBe("₹10.05");
    });

    it("handles negative amounts for customer advance payments", () => {
      expect(formatINR(-30000)).toBe("-₹300");
      expect(formatINR(-150050)).toBe("-₹1,500.50");
    });

    it("supports optional symbol and decimal flags", () => {
      expect(formatINR(12500000, { includeSymbol: false })).toBe("1,25,000");
      expect(formatINR(50000, { showDecimalsIfZero: true })).toBe("₹500.00");
    });
  });

  describe("calculateLineAmountPaise", () => {
    it("multiplies quantity by price paise accurately", () => {
      // 5 bags at ₹1,200 (120,000 paise) = ₹6,000 (600,000 paise)
      expect(calculateLineAmountPaise(5, 120000)).toBe(600000);

      // 2.5 kg at ₹45 (4,500 paise) = ₹112.50 (11,250 paise)
      expect(calculateLineAmountPaise(2.5, 4500)).toBe(11250);

      // Decimal bag qty e.g., 0.33 bags
      expect(calculateLineAmountPaise(0.33, 120000)).toBe(39600);
    });
  });
});
