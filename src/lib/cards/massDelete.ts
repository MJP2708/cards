import type { StoreDb } from "@/lib/db/scoped";
import { Prisma } from "@/generated/prisma/client";

/**
 * Deleting inventory in bulk.
 *
 * The single-card delete route already encodes the rules that matter, and they
 * are easy to lose sight of at scale:
 *
 *  - **A card with recorded sales is never deleted.** Sales are financial
 *    records and must outlive the thing they refer to; removing the card would
 *    orphan the history. Those cards are reported and skipped, not refused as a
 *    whole-batch error, because one sold card should not block clearing 219
 *    unsold ones.
 *  - **Price comps and snapshots go with the card.** Both relations default to
 *    RESTRICT, so a bare `deleteMany` fails outright on any card that has them.
 *    They are disposable reference data, so they are removed in the same
 *    transaction.
 *
 * Everything is planned before anything is written, because "delete all my
 * inventory" has no undo and the count is the only thing standing between a
 * reasonable action and an unrecoverable one.
 */

export type MassDeleteFilter = {
  /** Omitted = every category in the store. */
  category?: string;
  /** Omitted = every status. */
  status?: string;
};

export type MassDeletePlan = {
  /** Cards matching the filter. */
  matched: number;
  /** Of those, how many can actually go. */
  deletable: number;
  /** Cards held back because they have sales against them. */
  blocked: { id: string; lookupNumber: number; name: string; saleCount: number }[];
  /** Reference rows that will be removed alongside the cards. */
  priceComps: number;
  priceSnapshots: number;
  /** A few of the cards, so the preview is concrete rather than just a number. */
  sample: { lookupNumber: number; name: string; series: string }[];
};

function buildWhere(filter: MassDeleteFilter): Prisma.CardWhereInput {
  const where: Prisma.CardWhereInput = {};
  if (filter.category && filter.category !== "all") {
    where.category = { equals: filter.category, mode: "insensitive" };
  }
  if (filter.status) where.status = filter.status;
  return where;
}

/** Works out exactly what would be removed. Writes nothing. */
export async function planMassDelete(
  db: StoreDb,
  filter: MassDeleteFilter
): Promise<MassDeletePlan> {
  const where = buildWhere(filter);
  const cards = await db.card.findMany({
    where,
    select: { id: true, lookupNumber: true, name: true, series: true },
    orderBy: { lookupNumber: "asc" },
  });
  const ids = cards.map((card) => card.id);

  if (ids.length === 0) {
    return { matched: 0, deletable: 0, blocked: [], priceComps: 0, priceSnapshots: 0, sample: [] };
  }

  // One grouped query rather than a count per card.
  const salesByCard = await db.sale.groupBy({
    by: ["cardId"],
    where: { cardId: { in: ids } },
    _count: { _all: true },
  });
  const saleCounts = new Map(salesByCard.map((row) => [row.cardId, row._count._all]));

  const blocked = cards
    .filter((card) => saleCounts.has(card.id))
    .map((card) => ({
      id: card.id,
      lookupNumber: card.lookupNumber,
      name: card.name,
      saleCount: saleCounts.get(card.id) ?? 0,
    }));

  const deletableIds = ids.filter((id) => !saleCounts.has(id));
  const [priceComps, priceSnapshots] = await Promise.all([
    db.priceComp.count({ where: { cardId: { in: deletableIds } } }),
    db.priceSnapshot.count({ where: { cardId: { in: deletableIds } } }),
  ]);

  return {
    matched: cards.length,
    deletable: deletableIds.length,
    blocked,
    priceComps,
    priceSnapshots,
    sample: cards
      .filter((card) => !saleCounts.has(card.id))
      .slice(0, 8)
      .map(({ lookupNumber, name, series }) => ({ lookupNumber, name, series })),
  };
}

export type MassDeleteResult = {
  deleted: number;
  blocked: number;
  priceCompsRemoved: number;
  priceSnapshotsRemoved: number;
  nextLookupNumber: number;
};

export async function executeMassDelete(
  db: StoreDb,
  storeId: string,
  filter: MassDeleteFilter,
  options: { resetNumbering?: boolean } = {}
): Promise<MassDeleteResult> {
  const plan = await planMassDelete(db, filter);

  const blockedIds = new Set(plan.blocked.map((card) => card.id));
  const cards = await db.card.findMany({ where: buildWhere(filter), select: { id: true } });
  const ids = cards.map((card) => card.id).filter((id) => !blockedIds.has(id));

  if (ids.length > 0) {
    // One transaction: cards released from their reference rows and removed
    // together, so a failure cannot leave comps pointing at nothing.
    await db.$transaction([
      db.priceComp.deleteMany({ where: { cardId: { in: ids } } }),
      db.priceSnapshot.deleteMany({ where: { cardId: { in: ids } } }),
      db.card.deleteMany({ where: { id: { in: ids } } }),
    ]);
  }

  // Numbers are normally never reused, so the counter only ever climbs. Emptying
  // a store to re-import it under the supplier's own numbering is the one case
  // where starting again at 1 is what the user means — but it is opt-in, because
  // after it a number can refer to a different card than it did last week.
  let nextLookupNumber: number;
  if (options.resetNumbering && (await db.card.count()) === 0) {
    await db.store.update({ where: { id: storeId }, data: { nextLookupNumber: 1 } });
    nextLookupNumber = 1;
  } else {
    const store = await db.store.findFirst({ where: { id: storeId }, select: { nextLookupNumber: true } });
    nextLookupNumber = store?.nextLookupNumber ?? 1;
  }

  return {
    deleted: ids.length,
    blocked: plan.blocked.length,
    priceCompsRemoved: plan.priceComps,
    priceSnapshotsRemoved: plan.priceSnapshots,
    nextLookupNumber,
  };
}
