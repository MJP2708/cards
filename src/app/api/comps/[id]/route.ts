import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPrismaNotFoundError, notFoundResponse } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.priceComp.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isPrismaNotFoundError(error)) return notFoundResponse();
    throw error;
  }
}
