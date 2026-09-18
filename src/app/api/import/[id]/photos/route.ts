import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guards";
import { fetchPhotosNextChunk } from "@/lib/import/photos";

type Params = { params: Promise<{ id: string }> };

/**
 * Advances the post-import reference-photo pass by one chunk.
 *
 * Driven by the same client-side poller as enrichment and verification, so a
 * large import cannot be cut short by a serverless time limit part-way through.
 */
export async function POST(_request: Request, { params }: Params) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;
  const { id } = await params;
  try {
    return NextResponse.json(await fetchPhotosNextChunk(gate.db, gate.user.storeId, id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Photo fetch failed." },
      { status: 400 }
    );
  }
}
