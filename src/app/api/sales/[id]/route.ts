import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPrismaNotFoundError, notFoundResponse } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

// "Undo" for the Mark Sold undo-toast — restores the card's quantity and
// In Stock status, then deletes the Sale record. Only meaningful within the
// toast's short grace window; not exposed as a general "unsell" feature.
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id }, include: { card: true } });

    await prisma.$transaction([
      prisma.card.update({
        where: { id: sale.cardId },
        data: {
          quantity: sale.card.quantity + sale.quantitySold,
          status: "In Stock",
          dateSold: null,
          soldPrice: null,
        },
      }),
      prisma.sale.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isPrismaNotFoundError(error)) return notFoundResponse();
    throw error;
  }
}
