import { prisma } from "@/lib/prisma";

export type DashboardStats = {
  totalInventoryValue: number;
  inStockCount: number;
  soldCount: number;
  todayRevenue: number;
  todayItemsSold: number;
  yesterdayRevenue: number;
  yesterdayItemsSold: number;
  topSelling: { name: string; revenue: number; itemCount: number }[];
  cardTypePerformance: { cardType: string; profit: number; itemCount: number }[];
  profitOverTime: { date: string; cumulativeProfit: number }[];
  categoryBreakdown: { category: string; revenue: number; profit: number; itemCount: number }[];
  agingInventory: { id: string; category: string; name: string; askingPrice: number; daysInStock: number }[];
  hotNeedsAttention: { id: string; category: string; name: string; askingPrice: number }[];
};

const AGING_THRESHOLD_DAYS = 3;
const STALE_COMP_DAYS = 7;

export async function buildDashboardStats(): Promise<DashboardStats> {
  const [inStockCards, soldCount, sales, hotCards] = await Promise.all([
    prisma.card.findMany({ where: { status: "In Stock" } }),
    prisma.card.count({ where: { status: "Sold" } }),
    prisma.sale.findMany({ include: { card: true }, orderBy: { timestamp: "asc" } }),
    prisma.card.findMany({
      where: { isHot: true, status: { not: "Sold" } },
      include: { priceComps: { orderBy: { fetchedAt: "desc" }, take: 1 } },
    }),
  ]);

  const totalInventoryValue = inStockCards.reduce((sum, c) => sum + c.askingPrice * c.quantity, 0);
  const todayKey = new Date().toISOString().slice(0, 10);
  const yesterdayKey = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const todaySales = sales.filter((s) => s.timestamp.toISOString().slice(0, 10) === todayKey);
  const yesterdaySales = sales.filter((s) => s.timestamp.toISOString().slice(0, 10) === yesterdayKey);
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.soldPrice, 0);
  const yesterdayRevenue = yesterdaySales.reduce((sum, s) => sum + s.soldPrice, 0);

  const now = Date.now();
  const agingInventory = inStockCards
    .map((c) => ({
      id: c.id,
      category: c.category,
      name: c.name,
      askingPrice: c.askingPrice,
      daysInStock: Math.floor((now - c.dateAdded.getTime()) / 86_400_000),
    }))
    .filter((c) => c.daysInStock >= AGING_THRESHOLD_DAYS)
    .sort((a, b) => b.daysInStock - a.daysInStock)
    .slice(0, 5);

  const hotNeedsAttention = hotCards
    .filter((c) => {
      const latest = c.priceComps[0];
      if (!latest) return true;
      return now - latest.fetchedAt.getTime() > STALE_COMP_DAYS * 86_400_000;
    })
    .map((c) => ({ id: c.id, category: c.category, name: c.name, askingPrice: c.askingPrice }))
    .slice(0, 5);

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
    todayRevenue,
    todayItemsSold: todaySales.length,
    yesterdayRevenue,
    yesterdayItemsSold: yesterdaySales.length,
    topSelling: Array.from(byName.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8),
    cardTypePerformance: Array.from(byCardType.entries())
      .map(([cardType, v]) => ({ cardType, ...v }))
      .sort((a, b) => b.profit - a.profit),
    profitOverTime: Array.from(profitByDay.entries()).map(([date, cumulativeProfit]) => ({ date, cumulativeProfit })),
    categoryBreakdown: Array.from(byCategory.entries()).map(([category, v]) => ({ category, ...v })),
    agingInventory,
    hotNeedsAttention,
  };
}
