import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export type SalesReportLine = {
  saleId: string;
  timestamp: Date;
  category: string;
  cardName: string;
  series: string;
  photoFront: string | null;
  soldPrice: number;
  costBasis: number;
  profit: number;
  paymentMethod: string;
  buyerNote: string | null;
  groupKey: string; // team (sports) or series (TCG/Pokemon)
};

export type SalesReportGroup = {
  key: string;
  revenue: number;
  profit: number;
  itemCount: number;
};

export type SalesReportCategoryBreakdown = {
  category: string;
  revenue: number;
  profit: number;
  itemCount: number;
  groups: SalesReportGroup[];
};

export type SalesReport = {
  from: Date | null;
  to: Date | null;
  category: string | null;
  lines: SalesReportLine[];
  totals: { revenue: number; profit: number; itemCount: number };
  byCategory: SalesReportCategoryBreakdown[];
};

const SPORTS_CATEGORIES = new Set(["NBA", "Football"]);

export async function buildSalesReport(params: {
  from?: Date;
  to?: Date;
  category?: string;
}): Promise<SalesReport> {
  const where: Prisma.SaleWhereInput = {};
  if (params.from || params.to) {
    where.timestamp = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to ? { lte: params.to } : {}),
    };
  }
  if (params.category && params.category !== "all") {
    where.card = { category: { equals: params.category, mode: "insensitive" } };
  }

  const sales = await prisma.sale.findMany({
    where,
    include: { card: true },
    orderBy: { timestamp: "asc" },
  });

  const lines: SalesReportLine[] = sales.map((sale) => {
    const isSports = SPORTS_CATEGORIES.has(sale.card.category);
    const attrs = (sale.card.attributes as Record<string, unknown> | null) ?? {};
    const groupKey = isSports ? String(attrs.team ?? "Unknown team") : sale.card.series;
    return {
      saleId: sale.id,
      timestamp: sale.timestamp,
      category: sale.card.category,
      cardName: sale.card.name,
      series: sale.card.series,
      photoFront: sale.card.photoFront,
      soldPrice: sale.soldPrice,
      costBasis: sale.card.costBasis,
      profit: sale.soldPrice - sale.card.costBasis,
      paymentMethod: sale.paymentMethod,
      buyerNote: sale.card.buyerNote,
      groupKey,
    };
  });

  const totals = lines.reduce(
    (acc, l) => ({
      revenue: acc.revenue + l.soldPrice,
      profit: acc.profit + l.profit,
      itemCount: acc.itemCount + 1,
    }),
    { revenue: 0, profit: 0, itemCount: 0 }
  );

  const byCategoryMap = new Map<string, { lines: SalesReportLine[] }>();
  for (const line of lines) {
    if (!byCategoryMap.has(line.category)) byCategoryMap.set(line.category, { lines: [] });
    byCategoryMap.get(line.category)!.lines.push(line);
  }

  const byCategory: SalesReportCategoryBreakdown[] = Array.from(byCategoryMap.entries()).map(
    ([category, { lines: catLines }]) => {
      const groupMap = new Map<string, SalesReportGroup>();
      for (const line of catLines) {
        const g = groupMap.get(line.groupKey) ?? { key: line.groupKey, revenue: 0, profit: 0, itemCount: 0 };
        g.revenue += line.soldPrice;
        g.profit += line.profit;
        g.itemCount += 1;
        groupMap.set(line.groupKey, g);
      }
      return {
        category,
        revenue: catLines.reduce((s, l) => s + l.soldPrice, 0),
        profit: catLines.reduce((s, l) => s + l.profit, 0),
        itemCount: catLines.length,
        groups: Array.from(groupMap.values()).sort((a, b) => b.revenue - a.revenue),
      };
    }
  );

  return {
    from: params.from ?? null,
    to: params.to ?? null,
    category: params.category ?? null,
    lines,
    totals,
    byCategory,
  };
}
