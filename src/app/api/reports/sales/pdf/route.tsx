import { renderToBuffer } from "@react-pdf/renderer";
import { buildSalesReport } from "@/lib/reports/salesReport";
import { SalesReportPdf } from "@/lib/reports/SalesReportPdf";
import { getCategoryByKey } from "@/lib/categories";
import { getStoreName } from "@/lib/storeName";
import { requireStore } from "@/lib/auth/guards";

export async function GET(request: Request) {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");
  const title = searchParams.get("title") ?? "Sales Report";

  const report = await buildSalesReport(gate.db, {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    category: category ?? undefined,
  });

  const categoryRow = category && category !== "all" ? await getCategoryByKey(gate.db, category) : null;
  const accentColor = categoryRow?.themeTokens.accent;

  const storeName = await getStoreName(gate.user.storeId);
  const buffer = await renderToBuffer(
    <SalesReportPdf report={report} title={title} storeName={storeName} accentColor={accentColor} />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sales-report-${Date.now()}.pdf"`,
    },
  });
}
