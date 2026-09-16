import { NextResponse } from "next/server";
import { requireStore } from "@/lib/auth/guards";
import { verifyOneCard } from "@/lib/verification/verify";

type Params = { params: Promise<{ id: string }> };

/** Manual "Re-verify" for one card. Writes only the verification columns. */
export async function POST(_request: Request, { params }: Params) {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;
  const { id } = await params;

  const verdict = await verifyOneCard(gate.db, id);
  if (!verdict) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    status: verdict.status,
    notes: verdict.notes,
    // The per-check breakdown is what makes a verdict auditable rather than a
    // bare label the user has to take on trust.
    outcomes: verdict.outcomes,
  });
}
