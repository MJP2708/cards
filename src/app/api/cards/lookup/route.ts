import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";

export async function GET(request: Request) {
  const gate = await requireUser();
  if ("response" in gate) return gate.response;

  const { searchParams } = new URL(request.url);
  const qrCode = searchParams.get("qrCode");
  if (!qrCode) return NextResponse.json({ error: "qrCode is required" }, { status: 400 });

  const card =
    (await prisma.card.findUnique({ where: { qrCode } })) ??
    (await prisma.card.findUnique({ where: { id: qrCode } }));
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(card);
}
