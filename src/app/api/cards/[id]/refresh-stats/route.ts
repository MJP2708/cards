import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { fetchLiveStats } from "@/lib/liveStats";

const MIN_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour — free-tier rate limits are tight

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  const card = await prisma.card.findUnique({ where: { id } });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!force && card.liveStatsFetchedAt) {
    const age = Date.now() - card.liveStatsFetchedAt.getTime();
    if (age < MIN_REFRESH_INTERVAL_MS) {
      return NextResponse.json({ stats: card.liveStats, cached: true });
    }
  }

  const result = await fetchLiveStats({
    category: card.category,
    name: card.name,
    year: card.year,
    attributes: card.attributes,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  const updated = await prisma.card.update({
    where: { id },
    data: {
      liveStats: result.stats as unknown as Prisma.InputJsonValue,
      liveStatsFetchedAt: new Date(),
    },
  });

  return NextResponse.json({ stats: updated.liveStats, cached: false });
}
