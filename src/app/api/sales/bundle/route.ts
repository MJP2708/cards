import { NextResponse } from "next/server";
import { bundleSaleSchema } from "@/lib/validation/card";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { requireStore } from "@/lib/auth/guards";

export async function POST(request: Request) {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;

  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = bundleSaleSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { cardIds, totalPrice, paymentMethod, buyerContact } = parsed.data;

  const cards = await gate.db.card.findMany({ where: { id: { in: cardIds } } });
  if (cards.length !== cardIds.length) {
    return NextResponse.json({ error: "Some cards were not found" }, { status: 404 });
  }

  const askingTotal = cards.reduce((sum, c) => sum + c.askingPrice, 0) || 1;

  const bundle = await gate.db.bundle.create({
    data: { storeId: gate.user.storeId, totalPrice, paymentMethod, buyerContact },
  });

  await gate.db.$transaction(
    cards.map((card) => {
      const allocatedPrice =
        Math.round((totalPrice * (card.askingPrice / askingTotal)) * 100) / 100;
      return gate.db.sale.create({
        data: {
          storeId: gate.user.storeId,
          cardId: card.id,
          soldPrice: allocatedPrice,
          paymentMethod,
          buyerContact,
          bundleId: bundle.id,
          // Same audit trail as a single sale: bundle rows were previously
          // written with no userId, so they showed no seller in reports.
          userId: gate.user.id,
        },
      });
    })
  );

  await gate.db.$transaction(
    cards.map((card) =>
      gate.db.card.update({
        where: { id: card.id },
        data: { quantity: 0, status: "Sold", dateSold: new Date() },
      })
    )
  );

  return NextResponse.json(bundle, { status: 201 });
}
