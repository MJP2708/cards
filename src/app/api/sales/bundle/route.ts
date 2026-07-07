import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bundleSaleSchema } from "@/lib/validation/card";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";

export async function POST(request: Request) {
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = bundleSaleSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { cardIds, totalPrice, paymentMethod, buyerContact } = parsed.data;

  const cards = await prisma.card.findMany({ where: { id: { in: cardIds } } });
  if (cards.length !== cardIds.length) {
    return NextResponse.json({ error: "Some cards were not found" }, { status: 404 });
  }

  const askingTotal = cards.reduce((sum, c) => sum + c.askingPrice, 0) || 1;

  const bundle = await prisma.bundle.create({
    data: { totalPrice, paymentMethod, buyerContact },
  });

  await prisma.$transaction(
    cards.map((card) => {
      const allocatedPrice =
        Math.round((totalPrice * (card.askingPrice / askingTotal)) * 100) / 100;
      return prisma.sale.create({
        data: {
          cardId: card.id,
          soldPrice: allocatedPrice,
          paymentMethod,
          buyerContact,
          bundleId: bundle.id,
        },
      });
    })
  );

  await prisma.$transaction(
    cards.map((card) =>
      prisma.card.update({
        where: { id: card.id },
        data: { quantity: 0, status: "Sold", dateSold: new Date() },
      })
    )
  );

  return NextResponse.json(bundle, { status: 201 });
}
