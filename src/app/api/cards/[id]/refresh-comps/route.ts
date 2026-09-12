import { NextResponse } from "next/server";
import { fromUsd } from "@/lib/currency";
import { requireStore } from "@/lib/auth/guards";
import {
  EBAY_COMP_SOURCE,
  buildQuery,
  hasEbayCredentials,
  missingCredentialsError,
  searchEbayComps,
} from "@/lib/comps/ebay";

const MIN_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // same 1-hour guard as refresh-stats

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  if (!hasEbayCredentials()) {
    return NextResponse.json({ error: missingCredentialsError() }, { status: 422 });
  }

  const card = await gate.db.card.findUnique({ where: { id } });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Everything in this app is denominated in THB and eBay quotes USD. Without a
  // configured rate we would be writing dollar figures into baht fields, so refuse
  // rather than silently misprice the card by ~35x.
  const settings = await gate.db.settings.findUnique({ where: { id: "singleton" } });
  if (!settings?.usdExchangeRate) {
    return NextResponse.json(
      { error: "Set a THB-per-USD exchange rate in Settings first — eBay quotes prices in USD." },
      { status: 422 }
    );
  }

  const existing = await gate.db.priceComp.findMany({
    where: { cardId: id, source: EBAY_COMP_SOURCE },
    orderBy: { fetchedAt: "desc" },
    take: 1,
  });
  if (!force && existing[0] && Date.now() - existing[0].fetchedAt.getTime() < MIN_REFRESH_INTERVAL_MS) {
    const cached = await gate.db.priceComp.findMany({ where: { cardId: id }, orderBy: { fetchedAt: "desc" } });
    return NextResponse.json({ comps: cached, cached: true });
  }

  const query = buildQuery(card);
  let results;
  try {
    results = await searchEbayComps(query);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "eBay lookup failed." },
      { status: 422 }
    );
  }

  if (results.length === 0) {
    return NextResponse.json({ error: `No active eBay listings matched "${query}".` }, { status: 422 });
  }

  // Replace only previously auto-fetched comps — comps logged by hand are left alone.
  await gate.db.$transaction([
    gate.db.priceComp.deleteMany({ where: { cardId: id, source: EBAY_COMP_SOURCE } }),
    gate.db.priceComp.createMany({
      data: results.map((result) => ({
        storeId: gate.user.storeId,
        cardId: id,
        source: EBAY_COMP_SOURCE,
        price: Math.round(fromUsd(result.priceUsd, settings.usdExchangeRate)!),
        url: result.url,
      })),
    }),
  ]);

  const comps = await gate.db.priceComp.findMany({ where: { cardId: id }, orderBy: { fetchedAt: "desc" } });
  return NextResponse.json({ comps, cached: false, query, matched: results.length });
}
