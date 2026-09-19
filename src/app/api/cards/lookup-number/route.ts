import { NextResponse } from "next/server";
import { requireStore } from "@/lib/auth/guards";
import { parseLookupNumber } from "@/lib/lookupNumber";

/**
 * Resolves a quick-reference number to a card.
 *
 * Its own endpoint rather than a filter on /api/cards because the answer is
 * always exactly one card or none, and the caller wants to navigate, not to
 * render a list — returning the category too saves the client a second request
 * just to build the URL.
 */
export async function GET(request: Request) {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;

  const { searchParams } = new URL(request.url);
  const parsed = parseLookupNumber(searchParams.get("number") ?? "");
  if (parsed === null) {
    return NextResponse.json({ error: "Enter a card number, e.g. 47." }, { status: 400 });
  }

  const card = await gate.db.card.findFirst({
    where: { lookupNumber: parsed },
    select: { id: true, category: true, name: true, lookupNumber: true },
  });
  if (!card) return NextResponse.json({ error: "No card with that number.", number: parsed }, { status: 404 });

  return NextResponse.json(card);
}
