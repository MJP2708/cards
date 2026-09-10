import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { runDiagnostics } from "@/lib/diagnostics";

export async function GET(request: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const force = new URL(request.url).searchParams.get("force") === "true";
  return NextResponse.json({ checkedAt: new Date().toISOString(), integrations: await runDiagnostics({ force }) });
}
