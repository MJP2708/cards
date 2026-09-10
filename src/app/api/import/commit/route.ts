import { NextResponse, after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { cardInputSchema } from "@/lib/validation/card";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { enrichNextChunk } from "@/lib/import/enrich";

const commitSchema = z.object({
  fileName: z.string().min(1),
  rows: z
    .array(
      z.object({
        card: cardInputSchema,
        // "merge" adds the row's quantity to the existing card instead of duplicating it.
        action: z.enum(["new", "merge", "skip"]).default("new"),
        duplicateOfId: z.string().optional().nullable(),
        needsReview: z.boolean().optional(),
        reviewReason: z.string().optional().nullable(),
      })
    )
    .min(1),
});

export async function POST(request: Request) {
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = commitSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { fileName, rows } = parsed.data;
  const toCreate = rows.filter((row) => row.action === "new");
  const toMerge = rows.filter((row) => row.action === "merge" && row.duplicateOfId);

  const batch = await prisma.importBatch.create({
    data: { fileName, rowCount: rows.length, status: "importing" },
  });

  await prisma.card.createMany({
    data: toCreate.map((row) => ({
      ...row.card,
      attributes: row.card.attributes as Prisma.InputJsonValue | undefined,
      importBatchId: batch.id,
      enrichmentStatus: "pending",
      needsReview: row.needsReview ?? false,
      reviewReason: row.reviewReason ?? null,
    })),
  });

  // Merges only move quantity — they never overwrite pricing the user already set.
  for (const row of toMerge) {
    await prisma.card.update({
      where: { id: row.duplicateOfId! },
      data: { quantity: { increment: row.card.quantity ?? 1 } },
    });
  }

  const updated = await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      importedCount: toCreate.length,
      status: toCreate.length > 0 ? "enriching" : "complete",
      finishedAt: toCreate.length > 0 ? null : new Date(),
      reviewCount: toCreate.filter((row) => row.needsReview).length,
    },
  });

  // Kick off the first chunk once the response is out; the client's progress poller
  // drives the rest, so a long import is never cut short by a function timeout.
  if (toCreate.length > 0) {
    after(async () => {
      try {
        await enrichNextChunk(batch.id);
      } catch {
        // Enrichment is best-effort — the cards are already safely imported.
      }
    });
  }

  return NextResponse.json(
    {
      batch: updated,
      created: toCreate.length,
      merged: toMerge.length,
      skipped: rows.length - toCreate.length - toMerge.length,
    },
    { status: 201 }
  );
}
