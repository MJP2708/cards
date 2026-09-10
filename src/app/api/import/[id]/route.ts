import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const batch = await prisma.importBatch.findUnique({ where: { id } });
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [pending, enriched, review] = await Promise.all([
    prisma.card.count({ where: { importBatchId: id, enrichmentStatus: "pending" } }),
    prisma.card.count({ where: { importBatchId: id, enrichmentStatus: "enriched" } }),
    prisma.card.count({ where: { importBatchId: id, needsReview: true } }),
  ]);

  return NextResponse.json({ batch, progress: { pending, enriched, review, total: batch.importedCount } });
}
