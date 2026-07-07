import { renderToBuffer } from "@react-pdf/renderer";
import { buildSalesReport } from "@/lib/reports/salesReport";
import { SalesReportPdf } from "@/lib/reports/SalesReportPdf";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");
  const title = searchParams.get("title") ?? "Sales Report";

  const report = await buildSalesReport({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    category: category ?? undefined,
  });

  const buffer = await renderToBuffer(<SalesReportPdf report={report} title={title} />);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sales-report-${Date.now()}.pdf"`,
    },
  });
}
