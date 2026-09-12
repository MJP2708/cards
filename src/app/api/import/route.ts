import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guards";

/** Import history log. */
export async function GET() {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;
  const batches = await gate.db.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(batches);
}
