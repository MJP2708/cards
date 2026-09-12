import { NextResponse } from "next/server";
import { buildDashboardStats } from "@/lib/reports/dashboard";
import { requireStore } from "@/lib/auth/guards";

export async function GET() {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;
  const stats = await buildDashboardStats(gate.db);
  return NextResponse.json(stats);
}
