import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/guards";
import { verifyCards } from "@/lib/verification/verify";
import { readJsonBody } from "@/lib/api";

/**
 * Bulk "Re-verify all".
 *
 * Worth having as its own action because verification grades whatever evidence is
 * on record at the time: once eBay approval lands, or stats are fetched for older
 * cards, the same inventory can be re-checked without a re-import.
 */
const bodySchema = z.object({
  /** Omitted = the whole store. */
  ids: z.array(z.string()).optional(),
  category: z.string().optional(),
  /** Cap per request so one call can't run past a serverless time limit. */
  limit: z.number().int().min(1).max(1000).optional(),
});

export async function POST(request: Request) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;

  const json = await readJsonBody(request);
  const parsed = bodySchema.safeParse(json.ok ? json.data : {});
  const input = parsed.success ? parsed.data : {};
  const limit = input.limit ?? 500;

  let ids = input.ids;
  if (!ids) {
    const cards = await gate.db.card.findMany({
      where: input.category ? { category: { equals: input.category, mode: "insensitive" } } : {},
      select: { id: true },
      // Oldest verdict first, so repeated calls sweep the whole store rather than
      // re-checking the same page every time.
      orderBy: { verifiedAt: { sort: "asc", nulls: "first" } },
      take: limit,
    });
    ids = cards.map((card) => card.id);
  }

  const result = await verifyCards(gate.db, ids.slice(0, limit));
  const remaining = await gate.db.card.count({ where: { verificationStatus: null } });
  return NextResponse.json({ ...result, remaining });
}
