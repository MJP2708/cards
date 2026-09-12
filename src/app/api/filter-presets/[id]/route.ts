import { NextResponse } from "next/server";
import { requireStore } from "@/lib/auth/guards";
import { isPrismaNotFoundError, notFoundResponse } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;
  const { id } = await params;
  try {
    await gate.db.filterPreset.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isPrismaNotFoundError(error)) return notFoundResponse();
    throw error;
  }
}
