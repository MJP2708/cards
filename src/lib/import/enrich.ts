import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { fetchLiveStats } from "@/lib/liveStats";
import { API_SPORTS_ENV_VAR, apiSportsKey, type ApiSport } from "@/lib/liveStats/apiSports";

/**
 * Enrichment runs in resumable chunks rather than one long pass: on Vercel a
 * route handler (even inside `after()`) is capped by max duration, so a large
 * worksheet would otherwise be cut off part-way with no way to continue. The
 * progress poller calls this until the batch reports `complete`.
 */
export const ENRICH_CHUNK_SIZE = 5;

/** A cached lookup older than this is re-fetched; younger is reused, quota-free. */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const CATEGORY_TO_SPORT: Record<string, ApiSport> = { NBA: "nba", Football: "football" };

function cacheKey(category: string, name: string, series: string) {
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

export async function enrichNextChunk(batchId: string, limit = ENRICH_CHUNK_SIZE): Promise<ChunkResult> {
  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("Import batch not found");

  // Claim rows before working them. The commit route kicks off the first chunk via
  // after() while the client's poller also calls in, and without a claim both would
  // pick up the same "pending" cards — double-spending a 10-req/min quota and
  // racing each other's writes. Flipping status to "processing" in one atomic
  // updateMany means only one worker can own a card.
  const candidates = await prisma.card.findMany({
    where: { importBatchId: batchId, enrichmentStatus: "pending" },
    select: { id: true },
    take: limit,
  });
  const claimed: string[] = [];
  for (const candidate of candidates) {
    const result = await prisma.card.updateMany({
      where: { id: candidate.id, enrichmentStatus: "pending" },
      data: { enrichmentStatus: "processing" },
    });
    if (result.count === 1) claimed.push(candidate.id);
  }
  const pending = await prisma.card.findMany({ where: { id: { in: claimed } } });

  for (const card of pending) {
    const sport = CATEGORY_TO_SPORT[card.category];

    // No provider for this category, or no key configured: skip cleanly. An import
    // must never fail because enrichment could not run.
    if (!sport) {
      await prisma.card.update({
        where: { id: card.id },
        data: { enrichmentStatus: "skipped" },
      });
      continue;
    }
    if (!apiSportsKey()) {
      await prisma.card.update({
        where: { id: card.id },
        data: { enrichmentStatus: "skipped" },
      });
      continue;
    }

    const key = cacheKey(card.category, card.name, card.series);
    const cached = await prisma.enrichmentCache.findUnique({ where: { key } });
    const fresh = cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS;

    if (fresh) {
      await prisma.card.update({
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
        await prisma.$transaction([
          prisma.card.update({
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
          prisma.enrichmentCache.upsert({
            where: { key },
            create: { key, provider: result.stats.provider, payload, hit: true },
            update: { payload, hit: true, fetchedAt: new Date(), provider: result.stats.provider },
          }),
        ]);
      } else {
        await prisma.card.update({
          where: { id: card.id },
          data: { enrichmentStatus: "failed", needsReview: true, reviewReason: result.error },
        });
        // Only remember genuine misses. A rate-limited or unreachable provider must
        // not be cached as "no such player", or a retry days later still says so.
        if (!result.retryable) {
          await prisma.enrichmentCache.upsert({
            where: { key },
            create: { key, provider: sport, payload: Prisma.DbNull, hit: false },
            update: { hit: false, fetchedAt: new Date() },
          });
        }
      }
    } catch (error) {
      // Network blip, quota exhaustion, provider outage — the card keeps every value
      // from the worksheet and is simply flagged for manual review.
      await prisma.card.update({
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
    prisma.card.count({
      where: { importBatchId: batchId, enrichmentStatus: { in: ["pending", "processing"] } },
    }),
    prisma.card.count({ where: { importBatchId: batchId, enrichmentStatus: "enriched" } }),
    prisma.card.count({ where: { importBatchId: batchId, needsReview: true } }),
  ]);

  const status = remaining === 0 ? "complete" : "enriching";
  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      enrichedCount: enriched,
      reviewCount: review,
      status,
      finishedAt: remaining === 0 ? new Date() : null,
    },
  });

  return { processed: pending.length, remaining, status };
}
