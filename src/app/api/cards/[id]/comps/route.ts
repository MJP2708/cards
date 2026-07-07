import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { priceCompInputSchema } from "@/lib/validation/priceComp";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = priceCompInputSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const comp = await prisma.priceComp.create({
    data: { cardId: id, source: parsed.data.source, price: parsed.data.price, url: parsed.data.url || null },
  });
  return NextResponse.json(comp, { status: 201 });
}
