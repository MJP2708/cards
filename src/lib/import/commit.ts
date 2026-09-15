import { Prisma } from "@/generated/prisma/client";
import type { StoreDb } from "@/lib/db/scoped";
import type { CardInput } from "@/lib/validation/card";

/**
 * The write half of the importer, kept out of the route handler so it can be
 * exercised directly (see `scripts/check-import-flow.ts`) rather than only
 * through an authenticated HTTP call.
 */

export type CommitRow = {
  card: CardInput;
  action: "new" | "update" | "merge" | "skip";
  existingId?: string | null;
  needsReview?: boolean;
  reviewReason?: string | null;
};

export type CommitTemplate = {
  name: string;
  headerSignature: string;
  fieldMap: Record<string, string | null>;
  categoryMap: Record<string, string>;
};

export type CommitResult = {
  batchId: string;
  created: number;
  updated: number;
  merged: number;
  skipped: number;
};

export async function commitImport(
  db: StoreDb,
  storeId: string,
  input: { fileName: string; rows: CommitRow[]; saveTemplate?: CommitTemplate | null }
): Promise<CommitResult> {
  const { fileName, rows, saveTemplate } = input;

  const toCreate = rows.filter((row) => row.action === "new");
  const toUpdate = rows.filter((row) => row.action === "update" && row.existingId);
  const toMerge = rows.filter((row) => row.action === "merge" && row.existingId);
  const skipped = rows.length - toCreate.length - toUpdate.length - toMerge.length;

  const batch = await db.importBatch.create({
    data: { storeId, fileName, rowCount: rows.length, status: "importing" },
  });

  try {
    // One transaction: a half-applied import is the outcome that would be genuinely
    // hard to unpick, because the rows that did land look like duplicates on the retry.
    await db.$transaction([
      ...(toCreate.length > 0
        ? [
            db.card.createMany({
              data: toCreate.map((row) => ({
                ...row.card,
                storeId,
                attributes: row.card.attributes as Prisma.InputJsonValue | undefined,
                importBatchId: batch.id,
                enrichmentStatus: "pending",
                needsReview: row.needsReview ?? false,
                reviewReason: row.reviewReason ?? null,
              })),
            }),
          ]
        : []),

      // An update carries the sheet's numbers onto the card already in stock. A zero
      // price or cost means "the sheet didn't say", not "it is free", so those are
      // left alone rather than wiping a figure the seller set by hand.
      ...toUpdate.map((row) =>
        db.card.update({
          where: { id: row.existingId! },
          data: {
            quantity: row.card.quantity ?? 1,
            status: row.card.status,
            ...(row.card.askingPrice > 0 ? { askingPrice: row.card.askingPrice } : {}),
            ...(row.card.costBasis > 0 ? { costBasis: row.card.costBasis } : {}),
          },
        })
      ),

      // Merges only move quantity — they never overwrite pricing the user already set.
      ...toMerge.map((row) =>
        db.card.update({
          where: { id: row.existingId! },
          data: { quantity: { increment: row.card.quantity ?? 1 } },
        })
      ),
    ]);
  } catch (error) {
    // The batch row exists but nothing landed; mark it so the history log does not
    // claim an import that did not happen.
    await db.importBatch.update({
      where: { id: batch.id },
      data: { status: "failed", finishedAt: new Date(), failedCount: rows.length },
    });
    throw error;
  }

  await db.importBatch.update({
    where: { id: batch.id },
    data: {
      importedCount: toCreate.length,
      updatedCount: toUpdate.length + toMerge.length,
      skippedCount: skipped,
      status: toCreate.length > 0 ? "enriching" : "complete",
      finishedAt: toCreate.length > 0 ? null : new Date(),
      reviewCount: toCreate.filter((row) => row.needsReview).length,
    },
  });

  if (saveTemplate) {
    // findFirst + create/update rather than upsert: the scoped client merges a
    // storeId filter into `where`, and a compound-unique upsert is the one shape
    // where that interacts awkwardly. Two queries, no ambiguity.
    const existing = await db.importMapping.findFirst({ where: { name: saveTemplate.name } });
    const data = {
      headerSignature: saveTemplate.headerSignature,
      fieldMap: saveTemplate.fieldMap as Prisma.InputJsonValue,
      categoryMap: saveTemplate.categoryMap as Prisma.InputJsonValue,
      lastUsedAt: new Date(),
    };
    if (existing) await db.importMapping.update({ where: { id: existing.id }, data });
    else await db.importMapping.create({ data: { ...data, storeId, name: saveTemplate.name } });
  }

  return {
    batchId: batch.id,
    created: toCreate.length,
    updated: toUpdate.length,
    merged: toMerge.length,
    skipped,
  };
}
