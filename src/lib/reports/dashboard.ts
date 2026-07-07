import { prisma } from "@/lib/prisma";

export type DashboardStats = {
  totalInventoryValue: number;
  inStockCount: number;
  soldCount: number;
  topSelling: { name: string; revenue: number; itemCount: number }[];
  cardTypePerformance: { cardType: string; profit: number; itemCount: number }[];
  profitOverTime: { date: string; cumulativeProfit: number }[];
  categoryBreakdown: { category: string; revenue: number; profit: number; itemCount: number }[];
};

export async function buildDashboardStats(): Promise<DashboardStats> {
  const [inStockCards, soldCount, sales] = await Promise.all([
    prisma.card.findMany({ where: { status: "In Stock" } }),
    prisma.card.count({ where: { status: "Sold" } }),
    prisma.sale.findMany({ include: { card: true }, orderBy: { timestamp: "asc" } }),
  ]);

  const totalInventoryValue = inStockCards.reduce((sum, c) => sum + c.askingPrice * c.quantity, 0);

  const byName = new Map<string, { revenue: number; itemCount: number }>();
  const byCardType = new Map<string, { profit: number; itemCount: number }>();
  const byCategory = new Map<string, { revenue: number; profit: number; itemCount: number }>();
  let cumulativeProfit = 0;
  const profitByDay = new Map<string, number>();

  for (const sale of sales) {
    const profit = sale.soldPrice - sale.card.costBasis;

    const nameEntry = byName.get(sale.card.name) ?? { revenue: 0, itemCount: 0 };
    nameEntry.revenue += sale.soldPrice;
    nameEntry.itemCount += 1;
    byName.set(sale.card.name, nameEntry);

    const typeKey = sale.card.cardType ?? "Unspecified";
    const typeEntry = byCardType.get(typeKey) ?? { profit: 0, itemCount: 0 };
    typeEntry.profit += profit;
    typeEntry.itemCount += 1;
    byCardType.set(typeKey, typeEntry);

    const catEntry = byCategory.get(sale.card.category) ?? { revenue: 0, profit: 0, itemCount: 0 };
    catEntry.revenue += sale.soldPrice;
    catEntry.profit += profit;
    catEntry.itemCount += 1;
    byCategory.set(sale.card.category, catEntry);

    cumulativeProfit += profit;
    const day = sale.timestamp.toISOString().slice(0, 10);
    profitByDay.set(day, cumulativeProfit);
  }

  return {
    totalInventoryValue,
    inStockCount: inStockCards.length,
    soldCount,
    topSelling: Array.from(byName.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8),
    cardTypePerformance: Array.from(byCardType.entries())
      .map(([cardType, v]) => ({ cardType, ...v }))
      .sort((a, b) => b.profit - a.profit),
    profitOverTime: Array.from(profitByDay.entries()).map(([date, cumulativeProfit]) => ({ date, cumulativeProfit })),
    categoryBreakdown: Array.from(byCategory.entries()).map(([category, v]) => ({ category, ...v })),
  };
}
