import { NextResponse } from "next/server";
import { enrichNextChunk } from "@/lib/import/enrich";
import { requireOwner } from "@/lib/auth/guards";

type Params = { params: Promise<{ id: string }> };

/** Processes the next chunk of a batch's enrichment queue. Safe to call repeatedly. */
export async function POST(_request: Request, { params }: Params) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;
  const { id } = await params;
  try {
    const result = await enrichNextChunk(gate.db, id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enrichment failed." },
      { status: 500 }
    );
  }
}
