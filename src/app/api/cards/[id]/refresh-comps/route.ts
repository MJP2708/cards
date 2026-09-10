import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fromUsd } from "@/lib/currency";
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
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  if (!hasEbayCredentials()) {
    return NextResponse.json({ error: missingCredentialsError() }, { status: 422 });
  }

  const card = await prisma.card.findUnique({ where: { id } });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Everything in this app is denominated in THB and eBay quotes USD. Without a
  // configured rate we would be writing dollar figures into baht fields, so refuse
  // rather than silently misprice the card by ~35x.
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!settings?.usdExchangeRate) {
    return NextResponse.json(
      { error: "Set a THB-per-USD exchange rate in Settings first — eBay quotes prices in USD." },
      { status: 422 }
    );
  }

  const existing = await prisma.priceComp.findMany({
    where: { cardId: id, source: EBAY_COMP_SOURCE },
    orderBy: { fetchedAt: "desc" },
    take: 1,
  });
  if (!force && existing[0] && Date.now() - existing[0].fetchedAt.getTime() < MIN_REFRESH_INTERVAL_MS) {
    const cached = await prisma.priceComp.findMany({ where: { cardId: id }, orderBy: { fetchedAt: "desc" } });
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
  await prisma.$transaction([
    prisma.priceComp.deleteMany({ where: { cardId: id, source: EBAY_COMP_SOURCE } }),
    prisma.priceComp.createMany({
      data: results.map((result) => ({
        cardId: id,
        source: EBAY_COMP_SOURCE,
        price: Math.round(fromUsd(result.priceUsd, settings.usdExchangeRate)!),
        url: result.url,
      })),
    }),
  ]);

  const comps = await prisma.priceComp.findMany({ where: { cardId: id }, orderBy: { fetchedAt: "desc" } });
  return NextResponse.json({ comps, cached: false, query, matched: results.length });
}
