import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";

export async function GET() {
  // A full database dump — cards, sales and buyer contacts. Admin only.
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

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
