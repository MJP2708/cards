import type { StoreDb } from "@/lib/db/scoped";
import { Prisma } from "@/generated/prisma/client";
import { fetchLiveStats } from "@/lib/liveStats";
import { API_SPORTS_ENV_VAR, apiSportsKey, type ApiSport } from "@/lib/liveStats/apiSports";

/**
 * `db` is the caller's store-scoped client. EnrichmentCache is deliberately not a
 * tenant table, and the scoping extension passes it through untouched, so cache
 * hits are shared across stores while every Card/ImportBatch write stays scoped.
 *
 * Enrichment runs in resumable chunks rather than one long pass: on Vercel a
 * route handler (even inside `after()`) is capped by max duration, so a large
 * worksheet would otherwise be cut off part-way with no way to continue. The
 * progress poller calls this until the batch reports `complete`.
 */
export const ENRICH_CHUNK_SIZE = 5;

/** A cached lookup older than this is re-fetched; younger is reused, quota-free. */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How long a claim stays valid before another worker may take the row back.
 *
 * The commit route starts the first chunk inside `after()`, which the platform can
 * cut off mid-flight; the rows it had already claimed then sit in "processing"
 * forever. Since `remaining` counts "processing" too, the batch never reports
 * complete and the client polls a batch that can never finish. Comfortably longer
 * than a real chunk of `ENRICH_CHUNK_SIZE` rate-limited lookups, so a live worker
 * is never undercut.
 */
const CLAIM_TIMEOUT_MS = 3 * 60 * 1000;

const CATEGORY_TO_SPORT: Record<string, ApiSport> = { NBA: "nba", Football: "football" };

/**
 * Exported so the verification pass can look up the very row enrichment wrote,
 * and tell "the provider says no such player" apart from "the free tier refused
 * the season" — two failures that look identical on the card itself.
 */
export function cacheKey(category: string, name: string, series: string) {
  return [category, name, series].map((part) => part.trim().toLowerCase()).join("|");
}

/** Which categories can actually be enriched right now, given configured keys. */
export function enrichmentAvailability() {
  const configured = Boolean(apiSportsKey());
  return Object.keys(CATEGORY_TO_SPORT).map((category) => ({
    category,
    envVar: API_SPORTS_ENV_VAR,
    configured,
  }));
}

export type ChunkResult = { processed: number; remaining: number; status: string };

export async function enrichNextChunk(
  db: StoreDb,
  batchId: string,
  limit = ENRICH_CHUNK_SIZE
): Promise<ChunkResult> {
  const batch = await db.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("Import batch not found");

  // Take back rows whose worker never finished. Without this a single cut-off
  // chunk strands the batch at "enriching" permanently.
  await db.card.updateMany({
    where: {
      importBatchId: batchId,
      enrichmentStatus: "processing",
      updatedAt: { lt: new Date(Date.now() - CLAIM_TIMEOUT_MS) },
    },
    data: { enrichmentStatus: "pending" },
  });

  // Claim rows before working them. The commit route kicks off the first chunk via
  // after() while the client's poller also calls in, and without a claim both would
  // pick up the same "pending" cards — double-spending a 10-req/min quota and
  // racing each other's writes. Flipping status to "processing" in one atomic
  // updateMany means only one worker can own a card.
  const candidates = await db.card.findMany({
    where: { importBatchId: batchId, enrichmentStatus: "pending" },
    select: { id: true },
    take: limit,
  });
  const claimed: string[] = [];
  for (const candidate of candidates) {
    const result = await db.card.updateMany({
      where: { id: candidate.id, enrichmentStatus: "pending" },
      data: { enrichmentStatus: "processing" },
    });
    if (result.count === 1) claimed.push(candidate.id);
  }
  const pending = await db.card.findMany({ where: { id: { in: claimed } } });

  for (const card of pending) {
    const sport = CATEGORY_TO_SPORT[card.category];

    // No provider for this category, or no key configured: skip cleanly. An import
    // must never fail because enrichment could not run.
    if (!sport) {
      await db.card.update({
        where: { id: card.id },
        data: { enrichmentStatus: "skipped" },
      });
      continue;
    }
    if (!apiSportsKey()) {
      await db.card.update({
        where: { id: card.id },
        data: { enrichmentStatus: "skipped" },
      });
      continue;
    }

    const key = cacheKey(card.category, card.name, card.series);
    const cached = await db.enrichmentCache.findUnique({ where: { key } });
    const fresh = cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS;

    if (fresh) {
      await db.card.update({
        where: { id: card.id },
        data: cached.hit
          ? {
              liveStats: cached.payload ?? Prisma.DbNull,
              liveStatsFetchedAt: cached.fetchedAt,
              enrichmentStatus: "enriched",
              needsReview: false,
              reviewReason: null,
            }
          : { enrichmentStatus: "failed", needsReview: true, reviewReason: "No stats match found (cached)." },
      });
      continue;
    }

    try {
      const result = await fetchLiveStats({
        category: card.category,
        name: card.name,
        year: card.year,
        attributes: card.attributes,
      });

      if (result.ok) {
        const payload = result.stats as unknown as Prisma.InputJsonValue;
        await db.$transaction([
          db.card.update({
            where: { id: card.id },
            // Clear any review flag left by an earlier failed attempt — otherwise a
            // card that enriched on retry still shows the old reason.
            data: {
              liveStats: payload,
              liveStatsFetchedAt: new Date(),
              enrichmentStatus: "enriched",
              needsReview: false,
              reviewReason: null,
            },
          }),
          db.enrichmentCache.upsert({
            where: { key },
            create: { key, provider: result.stats.provider, payload, hit: true },
            update: { payload, hit: true, fetchedAt: new Date(), provider: result.stats.provider },
          }),
        ]);
      } else {
        await db.card.update({
          where: { id: card.id },
          data: { enrichmentStatus: "failed", needsReview: true, reviewReason: result.error },
        });
        // Only remember genuine misses. A rate-limited provider, a plan limit, or a
        // card that is simply missing its team must not be cached as "no such
        // player", or fixing the real problem changes nothing until the TTL expires.
        if (result.genuineMiss) {
          await db.enrichmentCache.upsert({
            where: { key },
            create: { key, provider: sport, payload: Prisma.DbNull, hit: false },
            update: { hit: false, fetchedAt: new Date() },
          });
        }
      }
    } catch (error) {
      // Network blip, quota exhaustion, provider outage — the card keeps every value
      // from the worksheet and is simply flagged for manual review.
      await db.card.update({
        where: { id: card.id },
        data: {
          enrichmentStatus: "failed",
          needsReview: true,
          reviewReason: error instanceof Error ? error.message : "Enrichment failed.",
        },
      });
    }
  }

  const [remaining, enriched, review] = await Promise.all([
    db.card.count({
      where: { importBatchId: batchId, enrichmentStatus: { in: ["pending", "processing"] } },
    }),
    db.card.count({ where: { importBatchId: batchId, enrichmentStatus: "enriched" } }),
    db.card.count({ where: { importBatchId: batchId, needsReview: true } }),
  ]);

  // Verification runs after enrichment rather than beside it: the factual
  // team-for-season check reads the snapshot enrichment just stored on the card,
  // so running them concurrently would verify against data not yet fetched.
  const unverified =
    remaining === 0
      ? await db.card.count({ where: { importBatchId: batchId, verificationStatus: null } })
      : 0;

  const status = remaining > 0 ? "enriching" : unverified > 0 ? "verifying" : "complete";
  await db.importBatch.update({
    where: { id: batchId },
    data: {
      enrichedCount: enriched,
      reviewCount: review,
      status,
      finishedAt: status === "complete" ? new Date() : null,
    },
  });

  return { processed: pending.length, remaining, status };
}
