import type { StoreDb } from "@/lib/db/scoped";
import { fromUsd } from "@/lib/currency";
import {
  EBAY_COMP_SOURCE,
  buildQuery,
  hasEbayCredentials,
  missingCredentialsError,
  searchEbayComps,
} from "./ebay";

/** Median is used rather than mean: a single mispriced listing (a lot, a reprint,
 *  a typo'd Buy It Now) skews an average badly on samples this small. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export type CompRefreshResult =
  | { ok: true; matched: number; median: number; imageApplied: boolean; query: string }
  | { ok: false; reason: string; retryable: boolean };

type RefreshableCard = {
  id: string;
  name: string;
  series: string;
  year: number | null;
  cardNumber: string | null;
  photoFront: string | null;
  photoIsStock: boolean;
};

/**
 * Fetches current eBay listings for one card and records them two ways.
 *
 * `PriceComp` is replaced wholesale — it represents the *current* spread, so
 * stale listings must not linger. `PriceSnapshot` is appended instead, one row per
 * refresh, which is what makes a trend line possible: the comps table alone can
 * never express change over time because it is rewritten every time.
 *
 * Shared by the manual "Refresh comps" button and the worksheet import, so both
 * produce identical data rather than drifting apart.
 */
export async function refreshCompsForCard(
  db: StoreDb,
  storeId: string,
  card: RefreshableCard,
  options: { applyStockImage?: boolean } = {}
): Promise<CompRefreshResult> {
  if (!hasEbayCredentials()) {
    return { ok: false, reason: missingCredentialsError(), retryable: false };
  }

  // Everything here is denominated in THB and eBay quotes USD. Without a rate we
  // would write dollar figures into baht fields and misprice by roughly 35x.
  const settings = await db.settings.findUnique({ where: { storeId } });
  if (!settings?.usdExchangeRate) {
    return {
      ok: false,
      reason: "Set a THB-per-USD exchange rate in Settings first — eBay quotes prices in USD.",
      retryable: false,
    };
  }

  const query = buildQuery(card);
  let results;
  try {
    results = await searchEbayComps(query);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "eBay lookup failed.",
      retryable: true,
    };
  }

  if (results.length === 0) {
    return { ok: false, reason: `No active eBay listings matched "${query}".`, retryable: false };
  }

  const pricesThb = results
    .map((result) => Math.round(fromUsd(result.priceUsd, settings.usdExchangeRate)!))
    .filter((price) => Number.isFinite(price));

  if (pricesThb.length === 0) {
    return { ok: false, reason: "eBay returned listings with no usable prices.", retryable: false };
  }

  // Only fill in an image when the card has none, or when the one it has was itself
  // pulled from a listing. A photo the seller took always wins.
  const listingImage = results.find((result) => result.imageUrl)?.imageUrl ?? null;
  const applyImage =
    Boolean(options.applyStockImage && listingImage && (!card.photoFront || card.photoIsStock));

  await db.$transaction(async (tx) => {
    // Replace only previously auto-fetched comps — comps logged by hand are left alone.
    await tx.priceComp.deleteMany({ where: { cardId: card.id, source: EBAY_COMP_SOURCE } });
    await tx.priceComp.createMany({
      data: results.map((result, index) => ({
        storeId,
        cardId: card.id,
        source: EBAY_COMP_SOURCE,
        price: pricesThb[index] ?? pricesThb[0],
        url: result.url,
      })),
    });
    await tx.priceSnapshot.create({
      data: {
        storeId,
        cardId: card.id,
        source: EBAY_COMP_SOURCE,
        medianPrice: Math.round(median(pricesThb)),
        minPrice: Math.min(...pricesThb),
        maxPrice: Math.max(...pricesThb),
        sampleSize: pricesThb.length,
      },
    });
    if (applyImage && listingImage) {
      await tx.card.update({
        where: { id: card.id },
        data: { photoFront: listingImage, photoIsStock: true },
      });
    }
  });

  return {
    ok: true,
    matched: results.length,
    median: Math.round(median(pricesThb)),
    imageApplied: applyImage,
    query,
  };
}
