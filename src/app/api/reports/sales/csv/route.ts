import Papa from "papaparse";
import { buildSalesReport } from "@/lib/reports/salesReport";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");

  const report = await buildSalesReport({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    category: category ?? undefined,
  });

  const csv = Papa.unparse(
    report.lines.map((l) => ({
      Date: l.timestamp.toISOString(),
      Category: l.category,
      Card: l.cardName,
      "Series/Set": l.series,
      "Sold Price": l.soldPrice,
      "Cost Basis": l.costBasis,
      Profit: l.profit,
      "Payment Method": l.paymentMethod,
      "Buyer Note": l.buyerNote ?? "",
    }))
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="sales-report-${Date.now()}.csv"`,
    },
  });
}
