import { pricesRepo, PriceRecord } from "@/db/repositories/pricesRepo";
import { nowISO } from "@/utils/dates";

export interface PricePoint {
  id?: string;
  product_id: string;
  price_paise: number;
  effective_from: string;
  created_at?: string;
}

/**
 * Pure business logic function: Resolves the effective price for a product as of a specific point in time.
 *
 * Rules:
 * - Only prices with effective_from <= targetDate are eligible.
 * - If multiple prices match, the latest effective_from wins.
 * - If effective_from is identical, the one created later wins.
 * - If no price exists as of that date, returns null.
 */
export function resolveEffectivePrice(
  history: PricePoint[],
  targetDateISO: string
): number | null {
  const eligible = history.filter((p) => p.effective_from <= targetDateISO);
  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    if (a.effective_from !== b.effective_from) {
      return b.effective_from.localeCompare(a.effective_from);
    }
    const createdA = a.created_at || a.effective_from;
    const createdB = b.created_at || b.effective_from;
    return createdB.localeCompare(createdA);
  });

  return eligible[0].price_paise;
}

export const pricingService = {
  /**
   * Retrieves the current price in paise for a product as of now or a given date.
   */
  getCurrentPrice(productId: string, atDate?: string): number | null {
    return pricesRepo.getCurrentPrice(productId, atDate || nowISO());
  },

  /**
   * Updates product price by recording a new immutable price_history entry.
   * Never edits previous prices (Non-negotiable rule 2).
   */
  updateProductPrice(
    productId: string,
    newPricePaise: number,
    effectiveFromISO?: string
  ): PriceRecord {
    return pricesRepo.addPrice(productId, newPricePaise, effectiveFromISO);
  },

  /**
   * Returns complete history of price changes for a product.
   */
  getPriceHistory(productId: string): PriceRecord[] {
    return pricesRepo.getHistory(productId);
  },
};
