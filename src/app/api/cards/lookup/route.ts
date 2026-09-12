import { NextResponse } from "next/server";
import { requireStore } from "@/lib/auth/guards";

export async function GET(request: Request) {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;

  const { searchParams } = new URL(request.url);
  const qrCode = searchParams.get("qrCode");
  if (!qrCode) return NextResponse.json({ error: "qrCode is required" }, { status: 400 });

  // findFirst, not findUnique: qrCode is unique per store rather than globally,
  // and the scoped client supplies the storeId half of that pair.
  const card =
    (await gate.db.card.findFirst({ where: { qrCode } })) ??
    (await gate.db.card.findFirst({ where: { id: qrCode } }));
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(card);
}
