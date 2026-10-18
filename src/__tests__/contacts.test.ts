import { normalizeIndianPhone, importContacts } from "../services/contacts";
import { customersRepo } from "../db/repositories/customersRepo";
import { setDb } from "../db/client";
import { createMockDatabase } from "./testDb";

describe("Contacts Service", () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDatabase();
    setDb(mockDb);
  });

  afterAll(() => {
    setDb(null);
  });

  describe("normalizeIndianPhone", () => {
    it("normalizes 10-digit mobile numbers", () => {
      expect(normalizeIndianPhone("9876543210")).toBe("9876543210");
    });

    it("normalizes numbers with +91 prefix and formatting characters", () => {
      expect(normalizeIndianPhone("+91 98765 43210")).toBe("9876543210");
      expect(normalizeIndianPhone("+91-98765-43210")).toBe("9876543210");
      expect(normalizeIndianPhone("+919876543210")).toBe("9876543210");
    });

    it("normalizes numbers with 0 prefix", () => {
      expect(normalizeIndianPhone("09876543210")).toBe("9876543210");
      expect(normalizeIndianPhone("0 98765 43210")).toBe("9876543210");
    });

    it("returns null for invalid or non-standard phone numbers", () => {
      expect(normalizeIndianPhone("12345")).toBeNull();
      expect(normalizeIndianPhone("abcdefghij")).toBeNull();
      expect(normalizeIndianPhone("")).toBeNull();
    });
  });

  describe("importContacts", () => {
    it("imports new contacts into customers repo and ignores duplicates", () => {
      // Pre-seed an existing customer
      customersRepo.create({
        name: "Existing Selvam",
        phone: "9876500000",
      });

      const contactsToImport = [
        {
          contactId: "c1",
          name: "Ramesh",
          phone: "9876511111",
          rawPhone: "+91 98765 11111",
          alreadyImported: false,
        },
        {
          contactId: "c2",
          name: "Suresh",
          phone: "9876522222",
          rawPhone: "09876522222",
          alreadyImported: false,
        },
        {
          contactId: "c3",
          name: "Duplicate Selvam",
          phone: "9876500000",
          rawPhone: "9876500000",
          alreadyImported: true,
        },
      ];

      const result = importContacts(contactsToImport);

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify the new customers exist
      const customers = customersRepo.list("all");
      expect(customers.some((c) => c.name === "Ramesh")).toBe(true);
      expect(customers.some((c) => c.name === "Suresh")).toBe(true);
    });
  });
});
