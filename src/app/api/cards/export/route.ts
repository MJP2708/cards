import Papa from "papaparse";
import { Prisma } from "@/generated/prisma/client";
import { requireStore } from "@/lib/auth/guards";

/**
 * Inventory as a spreadsheet, ordered by lookup number.
 *
 * The headers are deliberately the ones the importer's own alias list
 * recognises, so an export can be edited and re-imported without re-mapping —
 * and "Lookup #" stays distinct from "Card Number" (the number printed on the
 * card) so a round trip cannot swap one for the other.
 */
export async function GET(request: Request) {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status");

  const where: Prisma.CardWhereInput = {};
  if (category && category !== "all") where.category = { equals: category, mode: "insensitive" };
  if (status) where.status = status;

  // Numerical order, because the point of the column is to find a card by it —
  // the printed sheet should read the way the box is arranged.
  const cards = await gate.db.card.findMany({ where, orderBy: { lookupNumber: "asc" } });

  const csv = Papa.unparse(
    cards.map((card) => {
      const attributes = (card.attributes as Record<string, unknown> | null) ?? {};
      return {
        "Lookup #": card.lookupNumber,
        Category: card.category,
        Name: card.name,
        "Series/Set": card.series,
        Year: card.year ?? "",
        "Card Number": card.cardNumber ?? "",
        "Card Type": card.cardType ?? "",
        Rarity: card.rarity ?? "",
        Grade: card.grade ?? "",
        Team: typeof attributes.team === "string" ? attributes.team : "",
        "Cost Basis": card.costBasis,
        "Asking Price": card.askingPrice,
        Quantity: card.quantity,
        Status: card.status,
      };
    })
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-${Date.now()}.csv"`,
    },
  });
}
