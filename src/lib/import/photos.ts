import type { StoreDb } from "@/lib/db/scoped";
import { hasEbayCredentials } from "@/lib/comps/ebay";
import { refreshCompsForCard } from "@/lib/comps/refresh";

/**
 * Post-import reference photos.
 *
 * A worksheet row gives a seller a name and a price but no picture, and at a
 * booth "which card is this?" is answered by looking at it. This pass fills that
 * gap automatically so the seller does not have to photograph a hundred cards
 * before they mean anything.
 *
 * ## What the photo is, and is not
 * The image comes from an active marketplace listing, so it is *another* copy of
 * the same card — good enough to recognise it by, and useless for judging the
 * condition or centring of the copy actually in the box. Every card filled this
 * way is stamped `photoIsStock` and labelled in the UI, and a photo the seller
 * took themselves is never overwritten.
 *
 * ## Why it reuses the comps fetch
 * One eBay search returns both the price spread and the listing image. Fetching
 * them separately would double the call count for data already in hand, so this
 * runs `refreshCompsForCard` — the same function behind the manual button — and
 * takes both. A useful side effect: comps land before the verification pass
 * runs, which is what lets its price-against-market check actually fire.
 */

/**
 * Cards per invocation.
 *
 * Smaller than the verification chunk because each card here is a network round
 * trip, and larger than the enrichment chunk because eBay's Browse limit is a
 * daily quota rather than the per-minute ceiling API-Sports enforces — there is
 * no pacer to wait on between calls.
 */
export const PHOTO_CHUNK_SIZE = 8;

/** How long a claimed card may sit before another worker may take it back. */
const CLAIM_TIMEOUT_MS = 3 * 60 * 1000;

export type PhotoChunkResult = {
  processed: number;
  remaining: number;
  found: number;
  status: string;
};

export async function fetchPhotosNextChunk(
  db: StoreDb,
  storeId: string,
  batchId: string,
  limit = PHOTO_CHUNK_SIZE
): Promise<PhotoChunkResult> {
  const batch = await db.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("Import batch not found");

  // Take back rows whose worker never finished, so one cut-off invocation cannot
  // strand the batch at "photos" forever.
  await db.card.updateMany({
    where: {
      importBatchId: batchId,
      photoStatus: "processing",
      updatedAt: { lt: new Date(Date.now() - CLAIM_TIMEOUT_MS) },
    },
    data: { photoStatus: "pending" },
  });

  // With no credentials there is nothing to ask, so the whole batch resolves in
  // one step rather than pretending to work through it card by card.
  if (!hasEbayCredentials()) {
    await db.card.updateMany({
      where: { importBatchId: batchId, photoStatus: { in: ["pending", "processing"] } },
      data: { photoStatus: "skipped" },
    });
  }

  const candidates = await db.card.findMany({
    where: { importBatchId: batchId, photoStatus: "pending" },
    select: { id: true },
    take: limit,
  });

  // Claim before working, exactly as enrichment does: the client's poller and a
  // server-side kick-off can both be in flight, and without a claim they would
  // spend the same eBay quota twice on the same card.
  const claimed: string[] = [];
  for (const candidate of candidates) {
    const result = await db.card.updateMany({
      where: { id: candidate.id, photoStatus: "pending" },
      data: { photoStatus: "processing" },
    });
    if (result.count === 1) claimed.push(candidate.id);
  }

  const cards = await db.card.findMany({ where: { id: { in: claimed } } });

  for (const card of cards) {
    // A photo the seller took themselves is the real thing; never replace it.
    if (card.photoFront && !card.photoIsStock) {
      await db.card.update({ where: { id: card.id }, data: { photoStatus: "skipped" } });
      continue;
    }

    try {
      const result = await refreshCompsForCard(db, storeId, card, { applyStockImage: true });

      // "The marketplace has no listing for this card" is an answer, not a
      // breakage — the same distinction `retryable` already draws for comps. A
      // definitive miss is recorded as searched so the pass terminates and the
      // manual button does not keep re-asking a question already answered;
      // a transient failure stays retryable.
      const status = result.ok
        ? result.imageApplied
          ? "fetched"
          : "none"
        : result.retryable
          ? "failed"
          : "none";

      await db.card.update({ where: { id: card.id }, data: { photoStatus: status } });
    } catch {
      // The card imported fine and keeps every worksheet value — it simply has no
      // picture yet, which the manual button can retry later.
      await db.card.update({ where: { id: card.id }, data: { photoStatus: "failed" } });
    }
  }

  const [remaining, found] = await Promise.all([
    db.card.count({
      where: { importBatchId: batchId, photoStatus: { in: ["pending", "processing"] } },
    }),
    db.card.count({ where: { importBatchId: batchId, photoStatus: "fetched" } }),
  ]);

  // Verification comes next, not completion: the comps this pass just wrote are
  // what its price-against-market check reads.
  const unverified =
    remaining === 0
      ? await db.card.count({ where: { importBatchId: batchId, verificationStatus: null } })
      : 0;
  const status = remaining > 0 ? "photos" : unverified > 0 ? "verifying" : "complete";

  await db.importBatch.update({
    where: { id: batchId },
    data: {
      photoCount: found,
      status,
      finishedAt: status === "complete" ? new Date() : null,
    },
  });

  return { processed: cards.length, remaining, found, status };
}
