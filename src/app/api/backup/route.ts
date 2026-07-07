import { prisma } from "@/lib/prisma";

export async function GET() {
  const [cards, categories, sales, bundles, priceComps, filterPresets, settings] = await Promise.all([
    prisma.card.findMany(),
    prisma.category.findMany(),
    prisma.sale.findMany(),
    prisma.bundle.findMany(),
    prisma.priceComp.findMany(),
    prisma.filterPreset.findMany(),
    prisma.settings.findMany(),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    cards,
    categories,
    sales,
    bundles,
    priceComps,
    filterPresets,
    settings,
  };

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="cards-backup-${Date.now()}.json"`,
    },
  });
}
