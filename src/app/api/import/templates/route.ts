import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guards";

/** Saved column mappings for this store, most recently used first. */
export async function GET() {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;
  const templates = await gate.db.importMapping.findMany({ orderBy: { lastUsedAt: "desc" } });
  return NextResponse.json(templates);
}
