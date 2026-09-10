/**
 * Wipes imported / test data so it can't get mixed into real event inventory.
 *
 *   npx tsx --env-file=.env scripts/clear-test-data.ts --list
 *   npx tsx --env-file=.env scripts/clear-test-data.ts --batch <importBatchId>
 *   npx tsx --env-file=.env scripts/clear-test-data.ts --all-imports
 *   npx tsx --env-file=.env scripts/clear-test-data.ts --card <cardId>
 *
 * Deletion order matters: a card with sales is blocked by a foreign key (and by the
 * API's own 409), so sales are removed first. Nothing here touches cards you added
 * by hand — only cards linked to an ImportBatch, unless you name a card explicitly.
 * Add --yes to skip the dry-run summary and actually delete.
 */
import { prisma } from "../src/lib/prisma";

async function summarize(where: Record<string, unknown>) {
  const cards = await prisma.card.findMany({
    where,
    select: { id: true, name: true, series: true, category: true, _count: { select: { sales: true } } },
  });
  return cards;
}

async function deleteCards(cards: { id: string }[]) {
  const ids = cards.map((c) => c.id);
  if (ids.length === 0) return;
  await prisma.$transaction([
    prisma.sale.deleteMany({ where: { cardId: { in: ids } } }),
    prisma.priceComp.deleteMany({ where: { cardId: { in: ids } } }),
    prisma.card.deleteMany({ where: { id: { in: ids } } }),
  ]);
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--yes");
  const flag = args.find((a) => a.startsWith("--") && a !== "--yes");
  const value = args[args.indexOf(flag ?? "") + 1];

  if (flag === "--list" || !flag) {
    const batches = await prisma.importBatch.findMany({ orderBy: { createdAt: "desc" } });
    if (batches.length === 0) console.log("No import batches recorded.");
    for (const b of batches) {
      const count = await prisma.card.count({ where: { importBatchId: b.id } });
      console.log(`  ${b.id}  ${b.fileName}  ${b.createdAt.toISOString().slice(0, 16)}  ${count} cards still present`);
    }
    await prisma.$disconnect();
    return;
  }

  let where: Record<string, unknown>;
  if (flag === "--batch") where = { importBatchId: value };
  else if (flag === "--all-imports") where = { importBatchId: { not: null } };
  else if (flag === "--card") where = { id: value };
  else {
    console.error("Unknown option. See the comment at the top of this file.");
    process.exit(1);
  }

  const cards = await summarize(where);
  console.log(`${cards.length} card(s) matched:`);
  for (const c of cards) {
    console.log(`  ${c.category}  ${c.name} — ${c.series}${c._count.sales ? `  (${c._count.sales} sale(s) will also be deleted)` : ""}`);
  }

  if (!confirm) {
    console.log("\nDry run. Re-run with --yes to delete.");
    await prisma.$disconnect();
    return;
  }

  await deleteCards(cards);
  if (flag === "--batch") await prisma.importBatch.deleteMany({ where: { id: value } });
  if (flag === "--all-imports") await prisma.importBatch.deleteMany({});
  console.log(`\nDeleted ${cards.length} card(s) and their sales/comps.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
