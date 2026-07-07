import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markSoldSchema } from "@/lib/validation/card";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";

const saleCreateSchema = markSoldSchema.extend({ cardId: z.string() });

export async function GET(request: Request) {
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

  const sales = await prisma.sale.findMany({
    where,
    include: { card: true, bundle: true },
    orderBy: { timestamp: "desc" },
  });
  return NextResponse.json(sales);
}

export async function POST(request: Request) {
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = saleCreateSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { cardId, quantitySold, soldPrice, paymentMethod, buyerContact, buyerNote } = parsed.data;

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
  if (quantitySold > card.quantity) {
    return NextResponse.json({ error: `Only ${card.quantity} in stock` }, { status: 400 });
  }

  const remaining = card.quantity - quantitySold;
  const [sale] = await prisma.$transaction([
    prisma.sale.create({
      data: { cardId, soldPrice, paymentMethod, buyerContact },
    }),
    prisma.card.update({
      where: { id: cardId },
      data: {
        quantity: remaining,
        ...(remaining <= 0
          ? { status: "Sold", dateSold: new Date(), soldPrice }
          : {}),
        ...(buyerNote ? { buyerNote } : {}),
      },
    }),
  ]);
  return NextResponse.json(sale, { status: 201 });
}
