import { NextResponse } from "next/server";
import { bulkActionSchema } from "@/lib/validation/card";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth/guards";

export async function POST(request: Request) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = bulkActionSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { ids, action, payload } = parsed.data;

  switch (action) {
    case "delete": {
      // Not a bare deleteMany: price comps and snapshots both RESTRICT, so that
      // throws on any card carrying them, and it would happily remove a card
      // with recorded sales — which the single-card route refuses outright.
      const salesByCard = await gate.db.sale.groupBy({
        by: ["cardId"],
        where: { cardId: { in: ids } },
        _count: { _all: true },
      });
      const blocked = new Set(salesByCard.map((row) => row.cardId));
      const deletable = ids.filter((id) => !blocked.has(id));

      if (deletable.length > 0) {
        await gate.db.$transaction([
          gate.db.priceComp.deleteMany({ where: { cardId: { in: deletable } } }),
          gate.db.priceSnapshot.deleteMany({ where: { cardId: { in: deletable } } }),
          gate.db.card.deleteMany({ where: { id: { in: deletable } } }),
        ]);
      }

      return NextResponse.json({
        count: deletable.length,
        // Surfaced rather than silently dropped: the caller asked for these.
        blocked: blocked.size,
      });
    }
    case "markPacked":
    case "markUnpacked": {
      const result = await gate.db.card.updateMany({
        where: { id: { in: ids } },
        data: { packed: action === "markPacked" },
      });
      return NextResponse.json({ count: result.count });
    }
    case "priceAdjust": {
      if (!payload?.mode || payload.amount === undefined) {
        return NextResponse.json({ error: "mode and amount are required" }, { status: 400 });
      }
      const cards = await gate.db.card.findMany({ where: { id: { in: ids } } });
      await gate.db.$transaction(
        cards.map((card) => {
          const newPrice =
            payload.mode === "percent"
              ? card.askingPrice * (1 + payload.amount! / 100)
              : card.askingPrice + payload.amount!;
          return gate.db.card.update({
            where: { id: card.id },
            data: { askingPrice: Math.max(0, Math.round(newPrice * 100) / 100) },
          });
        })
      );
      return NextResponse.json({ count: cards.length });
    }
  }
}
