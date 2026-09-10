import { NextResponse } from "next/server";
import { buildDashboardStats } from "@/lib/reports/dashboard";
import { requireUser } from "@/lib/auth/guards";

export async function GET() {
  const gate = await requireUser();
  if ("response" in gate) return gate.response;
  const stats = await buildDashboardStats();
  return NextResponse.json(stats);
}
