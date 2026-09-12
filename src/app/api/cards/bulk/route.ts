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
      const result = await gate.db.card.deleteMany({ where: { id: { in: ids } } });
      return NextResponse.json({ count: result.count });
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
