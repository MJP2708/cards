import { requireOwner } from "@/lib/auth/guards";

export async function GET() {
  // A full database dump — cards, sales and buyer contacts. Admin only.
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;

  const [cards, categories, sales, bundles, priceComps, filterPresets, settings] = await Promise.all([
    gate.db.card.findMany(),
    gate.db.category.findMany(),
    gate.db.sale.findMany(),
    gate.db.bundle.findMany(),
    gate.db.priceComp.findMany(),
    gate.db.filterPreset.findMany(),
    gate.db.settings.findMany(),
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
