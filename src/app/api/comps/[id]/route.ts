import { NextResponse } from "next/server";
import { isPrismaNotFoundError, notFoundResponse } from "@/lib/api";
import { requireStore } from "@/lib/auth/guards";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;
  const { id } = await params;
  try {
    await gate.db.priceComp.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isPrismaNotFoundError(error)) return notFoundResponse();
    throw error;
  }
}
