import { NextResponse } from "next/server";
import { markSoldSchema } from "@/lib/validation/card";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { requireStore } from "@/lib/auth/guards";

const saleCreateSchema = markSoldSchema.extend({ cardId: z.string() });

export async function GET(request: Request) {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");

  const where: Prisma.SaleWhereInput = {};
  if (from || to) {
    where.timestamp = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (category && category !== "all") {
    where.card = { category: { equals: category, mode: "insensitive" } };
  }

  const sales = await gate.db.sale.findMany({
    where,
    include: { card: true, bundle: true },
    orderBy: { timestamp: "desc" },
  });
  return NextResponse.json(sales);
}

export async function POST(request: Request) {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = saleCreateSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { cardId, quantitySold, soldPrice, paymentMethod, buyerContact, buyerNote } = parsed.data;

  const card = await gate.db.card.findUnique({ where: { id: cardId } });
  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
  if (quantitySold > card.quantity) {
    return NextResponse.json({ error: `Only ${card.quantity} in stock` }, { status: 400 });
  }

  /**
   * The stock check and the decrement have to be one atomic step.
   *
   * Reading the quantity, checking it, then writing `quantity - quantitySold` as an
   * absolute value loses a decrement when two people sell the same card at once:
   * both read 2, both pass the check, both write 1, and the shop has sold two
   * copies but only counted one. With several phones on the till at a busy table
   * that is a routine race, not a rare one. The guarded `updateMany` below lets
   * Postgres arbitrate instead — whoever loses gets a 409 and can retry against
   * fresh stock.
   */
  const sale = await gate.db.$transaction(async (tx) => {
    const claimed = await tx.card.updateMany({
      where: { id: cardId, storeId: gate.user.storeId, quantity: { gte: quantitySold } },
      data: { quantity: { decrement: quantitySold } },
    });
    if (claimed.count === 0) return null;

    const after = await tx.card.findUnique({
      where: { id: cardId, storeId: gate.user.storeId },
      select: { quantity: true },
    });

    const soldOut = (after?.quantity ?? 0) <= 0;
    if (soldOut || buyerNote) {
      await tx.card.update({
        where: { id: cardId, storeId: gate.user.storeId },
        data: {
          ...(soldOut ? { status: "Sold", dateSold: new Date(), soldPrice } : {}),
          ...(buyerNote ? { buyerNote } : {}),
        },
      });
    }

    return tx.sale.create({
      // userId is the audit trail: with several people on the till, this is how a
      // questionable sale gets traced back to who rang it up.
      data: {
        storeId: gate.user.storeId,
        cardId,
        soldPrice,
        quantitySold,
        paymentMethod,
        buyerContact,
        userId: gate.user.id,
      },
    });
  });

  if (!sale) {
    return NextResponse.json(
      { error: "That card's stock changed while you were selling. Reload and try again." },
      { status: 409 }
    );
  }
  return NextResponse.json(sale, { status: 201 });
}
