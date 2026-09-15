import { NextResponse } from "next/server";
import { requireStore } from "@/lib/auth/guards";
import { EBAY_COMP_SOURCE } from "@/lib/comps/ebay";
import { refreshCompsForCard } from "@/lib/comps/refresh";

const MIN_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // same 1-hour guard as refresh-stats

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  const card = await gate.db.card.findUnique({ where: { id } });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await gate.db.priceComp.findMany({
    where: { cardId: id, source: EBAY_COMP_SOURCE },
    orderBy: { fetchedAt: "desc" },
    take: 1,
  });
  if (!force && existing[0] && Date.now() - existing[0].fetchedAt.getTime() < MIN_REFRESH_INTERVAL_MS) {
    const cached = await gate.db.priceComp.findMany({ where: { cardId: id }, orderBy: { fetchedAt: "desc" } });
    return NextResponse.json({ comps: cached, cached: true });
  }

  // A manual refresh fills in a reference image too, on the same terms as the
  // import: only when the card has no photo of its own.
  const result = await refreshCompsForCard(gate.db, gate.user.storeId, card, { applyStockImage: true });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 422 });
  }

  const comps = await gate.db.priceComp.findMany({ where: { cardId: id }, orderBy: { fetchedAt: "desc" } });
  return NextResponse.json({
    comps,
    cached: false,
    query: result.query,
    matched: result.matched,
    imageApplied: result.imageApplied,
  });
}
