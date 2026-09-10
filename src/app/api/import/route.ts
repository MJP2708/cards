import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";

/** Import history log. */
export async function GET() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(batches);
}
