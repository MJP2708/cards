import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Import history log. */
export async function GET() {
  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(batches);
}
