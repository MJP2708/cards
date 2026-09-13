import { NextResponse } from "next/server";
import { bundleSaleSchema } from "@/lib/validation/card";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { requireStore } from "@/lib/auth/guards";

/** Thrown inside the bundle transaction when a card was sold out from under us. */
class BundleStockConflict extends Error {
  constructor(readonly cardName: string) {
    super(`Already sold: ${cardName}`);
  }
}

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
  const unavailable = cards.filter((card) => card.quantity <= 0);
  if (unavailable.length > 0) {
    return NextResponse.json(
      { error: `Already sold: ${unavailable.map((card) => card.name).join(", ")}` },
      { status: 409 }
    );
  }

  const askingTotal = cards.reduce((sum, card) => sum + card.askingPrice, 0) || 1;

  /**
   * One transaction for the whole bundle.
   *
   * This used to run as three separate writes — bundle, then sales, then the card
   * updates — so a failure partway left sales recorded against cards still showing
   * In Stock. Each card is also claimed with a guarded update rather than being
   * zeroed outright: a card someone sold on another till a second earlier must not
   * be silently re-sold here. And the sale row now records the card's full
   * remaining quantity, because the bundle takes all of it — writing the default
   * quantitySold of 1 while zeroing a stock of 3 made inventory and sales disagree.
   */
  let bundle;
  try {
    bundle = await gate.db.$transaction(async (tx) => {
      const created = await tx.bundle.create({
        data: { storeId: gate.user.storeId, totalPrice, paymentMethod, buyerContact },
      });

      for (const card of cards) {
        const claimed = await tx.card.updateMany({
          where: { id: card.id, storeId: gate.user.storeId, quantity: { gt: 0 } },
          data: { quantity: 0, status: "Sold", dateSold: new Date() },
        });
        if (claimed.count === 0) throw new BundleStockConflict(card.name);

        const allocatedPrice = Math.round(totalPrice * (card.askingPrice / askingTotal) * 100) / 100;
        await tx.card.update({
          where: { id: card.id, storeId: gate.user.storeId },
          data: { soldPrice: allocatedPrice },
        });
        await tx.sale.create({
          data: {
            storeId: gate.user.storeId,
            cardId: card.id,
            soldPrice: allocatedPrice,
            quantitySold: card.quantity,
            paymentMethod,
            buyerContact,
            bundleId: created.id,
            // Same audit trail as a single sale: bundle rows were previously
            // written with no userId, so they showed no seller in reports.
            userId: gate.user.id,
          },
        });
      }

      return created;
    });
  } catch (error) {
    if (error instanceof BundleStockConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json(bundle, { status: 201 });
}
