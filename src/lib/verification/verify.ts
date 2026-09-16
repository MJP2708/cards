import type { StoreDb } from "@/lib/db/scoped";
import { fingerprint } from "@/lib/import/fingerprint";
import { cacheKey } from "@/lib/import/enrich";
import { hasApiSportsKey } from "@/lib/liveStats/apiSports";
import { hasEbayCredentials } from "@/lib/comps/ebay";
import {
  checkDuplicate,
  checkGradeFormat,
  checkPriceAgainstComps,
  checkPriceSanity,
  checkTeamForSeason,
  checkTeamSport,
  checkYearPlausible,
  type CheckOutcome,
  type CompSnapshot,
  type VerifiableCard,
} from "./checks";

/**
 * Post-commit correctness audit.
 *
 * ## What this never does
 * The only columns it writes are `verificationStatus`, `verificationNotes` and
 * `verifiedAt`. It never edits a card's data to "fix" a finding — if the team
 * looks wrong it says so and leaves the value alone, because the sources it
 * checks against are themselves fallible and a silent correction would be
 * unreviewable. `writeVerdict` below is the single place this module writes, and
 * those three columns are all it touches.
 *
 * ## Why it makes no API calls
 * The factual team check reads the API-Sports snapshot that the enrichment pass
 * already stored on `card.liveStats`. The free tier's binding limit is 10
 * requests per minute, shared across the whole account, so a verification pass
 * that re-asked the provider would roughly double import cost for an answer
 * already on disk. Price comps work the same way: this reads `PriceSnapshot`
 * rows and grades them, it does not fetch.
 */

/** Selects exactly the columns the checks need — nothing that could be written back. */
export const VERIFY_SELECT = {
  id: true,
  category: true,
  name: true,
  series: true,
  year: true,
  cardNumber: true,
  grade: true,
  attributes: true,
  costBasis: true,
  askingPrice: true,
  liveStats: true,
  enrichmentStatus: true,
} as const;

export type VerificationStatus = "VERIFIED" | "NEEDS_REVIEW" | "LIKELY_INCORRECT";

export type VerificationVerdict = {
  status: VerificationStatus;
  notes: string;
  outcomes: CheckOutcome[];
};

/**
 * Folds the individual outcomes into one status.
 *
 * Order matters: any high-severity failure dominates, then any low-severity one,
 * then anything that was attempted but could not be settled. Only when nothing
 * failed and nothing was left hanging does a card read as VERIFIED — and even
 * then, skipped checks are listed in the notes so "Verified" always says what it
 * actually covered.
 */
export function summarize(outcomes: CheckOutcome[]): VerificationVerdict {
  const failures = outcomes.filter((o) => o.result === "fail");
  const high = failures.filter((o) => o.result === "fail" && o.severity === "high");
  const unknowns = outcomes.filter((o) => o.result === "unknown");
  const skipped = outcomes.filter((o) => o.result === "skipped");

  const noteParts: string[] = [];
  for (const outcome of [...high, ...failures.filter((o) => !high.includes(o))]) {
    if (outcome.result === "fail") noteParts.push(outcome.note);
  }
  for (const outcome of unknowns) {
    if (outcome.result === "unknown") noteParts.push(outcome.note);
  }

  let status: VerificationStatus;
  if (high.length > 0) status = "LIKELY_INCORRECT";
  else if (failures.length > 0 || unknowns.length > 0) status = "NEEDS_REVIEW";
  else status = "VERIFIED";

  if (status === "VERIFIED") {
    const ran = outcomes.filter((o) => o.result === "pass").length;
    noteParts.push(
      skipped.length === 0
        ? `All ${ran} checks passed.`
        : `${ran} checks passed. Not checked: ${skipped
            .map((o) => (o.result === "skipped" ? o.note : ""))
            .join(" ")}`
    );
  } else if (skipped.length > 0) {
    // A flagged card still needs to say what went unexamined, so the user knows
    // the flag is not the whole picture.
    const compSkip = skipped.find((o) => o.result === "skipped" && o.check === "comps");
    if (compSkip && compSkip.result === "skipped") noteParts.push(compSkip.note);
  }

  return { status, notes: noteParts.join(" "), outcomes };
}

export type VerifyContext = {
  /** Fingerprint -> every card in this store carrying it, for duplicate detection. */
  fingerprintIndex: Map<string, { id: string; name: string }[]>;
  /** Card id -> its most recent comp snapshot, when one exists. */
  compsByCard: Map<string, CompSnapshot>;
  statsConfigured: boolean;
  compSourceAvailable: boolean;
  /**
   * Enrichment cache keys the provider answered "no such player" for. Only these
   * count against a card; a plan or quota failure is infrastructure, not evidence.
   */
  genuineMisses: Set<string>;
};

/** Runs every check against one card. Pure — performs no I/O and no writes. */
export function verifyCard(card: VerifiableCard, context: VerifyContext): VerificationVerdict {
  return summarize([
    checkTeamSport(card),
    checkYearPlausible(card),
    checkGradeFormat(card),
    checkPriceSanity(card),
    checkDuplicate(card, context.fingerprintIndex),
    checkTeamForSeason(
      card,
      context.statsConfigured,
      context.genuineMisses.has(cacheKey(card.category, card.name, card.series))
    ),
    checkPriceAgainstComps(card, context.compsByCard.get(card.id) ?? null, context.compSourceAvailable),
  ]);
}

/**
 * Builds the shared context every card in a pass needs.
 *
 * The fingerprint index spans the whole store, not just the cards being verified:
 * a newly imported card's duplicate is usually one that was already there.
 */
export async function buildContext(db: StoreDb, cardIds: string[]): Promise<VerifyContext> {
  const all = await db.card.findMany({
    select: { id: true, category: true, name: true, series: true, year: true, cardNumber: true, grade: true },
  });

  // The cache is the only place that records *why* a lookup produced nothing:
  // `hit: false` is written solely for genuine misses, never for a plan limit or
  // an exhausted quota. See the note in enrichNextChunk.
  const subjects = await db.card.findMany({
    where: cardIds.length > 0 ? { id: { in: cardIds } } : {},
    select: { category: true, name: true, series: true },
  });
  const keys = [...new Set(subjects.map((card) => cacheKey(card.category, card.name, card.series)))];
  const misses = keys.length > 0
    ? await db.enrichmentCache.findMany({ where: { key: { in: keys }, hit: false }, select: { key: true } })
    : [];
  const genuineMisses = new Set(misses.map((row) => row.key));

  const fingerprintIndex = new Map<string, { id: string; name: string }[]>();
  for (const card of all) {
    const key = fingerprint(card);
    const bucket = fingerprintIndex.get(key);
    if (bucket) bucket.push({ id: card.id, name: card.name });
    else fingerprintIndex.set(key, [{ id: card.id, name: card.name }]);
  }

  const compsByCard = new Map<string, CompSnapshot>();
  if (cardIds.length > 0) {
    // Newest first, then keep the first seen per card — one query rather than one per card.
    const snapshots = await db.priceSnapshot.findMany({
      where: { cardId: { in: cardIds } },
      orderBy: { capturedAt: "desc" },
      select: { cardId: true, medianPrice: true, sampleSize: true, capturedAt: true },
    });
    for (const snapshot of snapshots) {
      if (!compsByCard.has(snapshot.cardId)) {
        compsByCard.set(snapshot.cardId, {
          medianPrice: snapshot.medianPrice,
          sampleSize: snapshot.sampleSize,
          capturedAt: snapshot.capturedAt,
        });
      }
    }
  }

  return {
    fingerprintIndex,
    compsByCard,
    statsConfigured: hasApiSportsKey(),
    compSourceAvailable: hasEbayCredentials(),
    genuineMisses,
  };
}

/**
 * The single place verification is allowed to write.
 *
 * Every caller goes through here, so "this system only flags, it never corrects"
 * is enforced by construction rather than by remembering it at each call site.
 */
async function writeVerdict(db: StoreDb, cardId: string, verdict: VerificationVerdict) {
  await db.card.update({
    where: { id: cardId },
    data: {
      verificationStatus: verdict.status,
      // Trimmed: the column is read in a UI panel, not a log.
      verificationNotes: verdict.notes.slice(0, 1000) || null,
      verifiedAt: new Date(),
    },
  });
}

export type VerifyRunResult = { checked: number; verified: number; flagged: number };

/** Verifies a specific set of cards, by id. */
export async function verifyCards(db: StoreDb, cardIds: string[]): Promise<VerifyRunResult> {
  if (cardIds.length === 0) return { checked: 0, verified: 0, flagged: 0 };

  const context = await buildContext(db, cardIds);
  const cards = await db.card.findMany({ where: { id: { in: cardIds } }, select: VERIFY_SELECT });

  let verified = 0;
  let flagged = 0;
  for (const card of cards) {
    const verdict = verifyCard(card as VerifiableCard, context);
    if (verdict.status === "VERIFIED") verified++;
    else flagged++;
    await writeVerdict(db, card.id, verdict);
  }

  return { checked: cards.length, verified, flagged };
}

/** Verifies one card — used after a manual add or edit, and by the Re-verify button. */
export async function verifyOneCard(db: StoreDb, cardId: string): Promise<VerificationVerdict | null> {
  const context = await buildContext(db, [cardId]);
  const card = await db.card.findUnique({ where: { id: cardId }, select: VERIFY_SELECT });
  if (!card) return null;

  const verdict = verifyCard(card as VerifiableCard, context);
  await writeVerdict(db, cardId, verdict);
  return verdict;
}

/**
 * Chunk size for the post-import pass.
 *
 * Verification does no network I/O, so this is bounded by database round trips
 * rather than by a provider's rate limit — far larger than the enrichment chunk.
 */
export const VERIFY_CHUNK_SIZE = 50;

/**
 * Verifies the next slice of an import batch, resumably.
 *
 * Mirrors `enrichNextChunk`: the client's existing progress poller drives it, so a
 * large import cannot be cut short by a serverless time limit part-way through.
 */
export async function verifyNextChunk(
  db: StoreDb,
  batchId: string,
  limit = VERIFY_CHUNK_SIZE
): Promise<{ processed: number; remaining: number; status: string }> {
  const batch = await db.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("Import batch not found");

  const pending = await db.card.findMany({
    where: { importBatchId: batchId, verificationStatus: null },
    select: { id: true },
    take: limit,
  });

  if (pending.length > 0) {
    await verifyCards(
      db,
      pending.map((card) => card.id)
    );
  }

  const [remaining, verified, flagged] = await Promise.all([
    db.card.count({ where: { importBatchId: batchId, verificationStatus: null } }),
    db.card.count({ where: { importBatchId: batchId, verificationStatus: "VERIFIED" } }),
    db.card.count({
      where: { importBatchId: batchId, verificationStatus: { in: ["NEEDS_REVIEW", "LIKELY_INCORRECT"] } },
    }),
  ]);

  const status = remaining === 0 ? "complete" : "verifying";
  await db.importBatch.update({
    where: { id: batchId },
    data: {
      verifiedCount: verified,
      flaggedCount: flagged,
      status,
      finishedAt: remaining === 0 ? new Date() : null,
    },
  });

  return { processed: pending.length, remaining, status };
}
