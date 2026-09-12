import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guards";
import { runDiagnostics } from "@/lib/diagnostics";

export async function GET(request: Request) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;

  const force = new URL(request.url).searchParams.get("force") === "true";
  return NextResponse.json({ checkedAt: new Date().toISOString(), integrations: await runDiagnostics(gate.db, { force }) });
}
