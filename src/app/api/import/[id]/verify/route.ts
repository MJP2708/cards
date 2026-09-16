import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guards";
import { verifyNextChunk } from "@/lib/verification/verify";

type Params = { params: Promise<{ id: string }> };

/**
 * Advances the post-import verification pass by one chunk.
 *
 * Driven by the same client-side progress poller that drives enrichment, so a
 * large import is never cut short by a serverless time limit part-way through.
 */
export async function POST(_request: Request, { params }: Params) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;
  const { id } = await params;
  try {
    return NextResponse.json(await verifyNextChunk(gate.db, id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed." },
      { status: 400 }
    );
  }
}
