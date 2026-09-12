import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guards";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;
  const { id } = await params;
  const batch = await gate.db.importBatch.findUnique({ where: { id } });
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [pending, enriched, review] = await Promise.all([
    gate.db.card.count({ where: { importBatchId: id, enrichmentStatus: "pending" } }),
    gate.db.card.count({ where: { importBatchId: id, enrichmentStatus: "enriched" } }),
    gate.db.card.count({ where: { importBatchId: id, needsReview: true } }),
  ]);

  return NextResponse.json({ batch, progress: { pending, enriched, review, total: batch.importedCount } });
}
