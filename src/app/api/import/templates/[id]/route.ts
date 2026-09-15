import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guards";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;
  const { id } = await params;
  // Scoped client: another store's template reads as "not found", never deletes.
  const existing = await gate.db.importMapping.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await gate.db.importMapping.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
