import { NextResponse } from "next/server";
import { buildSalesReport } from "@/lib/reports/salesReport";
import { requireUser } from "@/lib/auth/guards";

export async function GET(request: Request) {
  const gate = await requireUser();
  if ("response" in gate) return gate.response;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");

  const report = await buildSalesReport({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    category: category ?? undefined,
  });
  return NextResponse.json(report);
}
