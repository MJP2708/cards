import { NextResponse } from "next/server";
import { buildDashboardStats } from "@/lib/reports/dashboard";

export async function GET() {
  const stats = await buildDashboardStats();
  return NextResponse.json(stats);
}
