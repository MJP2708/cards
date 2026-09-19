/**
 * Verifies bulk deletion of inventory.
 *
 *   docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=cards -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/cards \
 *   DIRECT_URL=postgresql://postgres:test@127.0.0.1:55432/cards npx prisma migrate deploy
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/check-mass-delete.ts
 *
 * Run it against a throwaway database — it writes two stores' worth of fixtures.
 *
 * Two rules carry the weight here. A card with recorded sales must survive, or
 * the sales history is orphaned; and price comps and snapshots must be cleared
 * with the card, or the delete fails outright on the RESTRICT constraint. Both
 * are asserted, along with the store boundary — a mass delete is exactly the
 * operation where a missing tenant filter would be catastrophic.
 */
import { prisma } from "../src/lib/prisma";
import { storeDb } from "../src/lib/db/scoped";
import { buildDefaultCategoryRows } from "../src/lib/defaultCategories";
import { planMassDelete, executeMassDelete } from "../src/lib/cards/massDelete";

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures++;
}

function section(title: string) {
  console.log(`\n${title}\n${"─".repeat(title.length)}`);
}

const CARD = { series: "2023 Panini Prizm", costBasis: 100, askingPrice: 200 };

async function makeStore(name: string) {
  const store = await prisma.store.create({ data: { name } });
  await prisma.category.createMany({ data: buildDefaultCategoryRows(store.id) });
  return store;
}

async function main() {
  const store = await makeStore("Clearing Store");
  const other = await makeStore("Bystander Store");
  const db = storeDb(store.id);
  const otherDb = storeDb(other.id);

  await db.card.createMany({
    data: [
      { storeId: store.id, lookupNumber: 1, category: "NBA", name: "Plain One", ...CARD },
      { storeId: store.id, lookupNumber: 2, category: "NBA", name: "Has Comps", ...CARD },
      { storeId: store.id, lookupNumber: 3, category: "NBA", name: "Was Sold", ...CARD },
      { storeId: store.id, lookupNumber: 4, category: "Football", name: "Other Category", ...CARD },
      { storeId: store.id, lookupNumber: 5, category: "NBA", name: "Reserved One", status: "Reserved", ...CARD },
    ],
  });
  await prisma.store.update({ where: { id: store.id }, data: { nextLookupNumber: 6 } });
  await otherDb.card.create({
    data: { storeId: other.id, lookupNumber: 1, category: "NBA", name: "Not Yours", ...CARD },
  });

  const hasComps = await db.card.findFirst({ where: { name: "Has Comps" } });
  await db.priceComp.createMany({
    data: [
      { storeId: store.id, cardId: hasComps!.id, source: "eBay (auto)", price: 100 },
      { storeId: store.id, cardId: hasComps!.id, source: "eBay (auto)", price: 120 },
    ],
  });
  await db.priceSnapshot.create({
    data: { storeId: store.id, cardId: hasComps!.id, source: "eBay (auto)", medianPrice: 110, minPrice: 100, maxPrice: 120, sampleSize: 2 },
  });

  const wasSold = await db.card.findFirst({ where: { name: "Was Sold" } });
  await db.sale.create({
    data: { storeId: store.id, cardId: wasSold!.id, soldPrice: 250, paymentMethod: "Cash" },
  });

  // ── 1. Preview ───────────────────────────────────────────────────────────
  section("1. previewing the whole store");

  const plan = await planMassDelete(db, {});
  check("matched all 5 cards", plan.matched === 5, String(plan.matched));
  check("4 are deletable", plan.deletable === 4, String(plan.deletable));
  check(
    "the sold card is held back and named",
    plan.blocked.length === 1 && plan.blocked[0].name === "Was Sold" && plan.blocked[0].saleCount === 1,
    JSON.stringify(plan.blocked)
  );
  check("comps and snapshots are counted", plan.priceComps === 2 && plan.priceSnapshots === 1,
    `${plan.priceComps} comps, ${plan.priceSnapshots} snapshots`);
  check("the sample excludes the blocked card", !plan.sample.some((c) => c.name === "Was Sold"));
  check("previewing wrote nothing", (await db.card.count()) === 5);

  // ── 2. Filtered ──────────────────────────────────────────────────────────
  section("2. filtering");

  const byCategory = await planMassDelete(db, { category: "Football" });
  check("category filter narrows to 1", byCategory.matched === 1 && byCategory.deletable === 1);

  const byStatus = await planMassDelete(db, { status: "Reserved" });
  check("status filter narrows to 1", byStatus.matched === 1, String(byStatus.matched));

  const deletedFootball = await executeMassDelete(db, store.id, { category: "Football" });
  check("deleted only the Football card", deletedFootball.deleted === 1, String(deletedFootball.deleted));
  check("the rest survive", (await db.card.count()) === 4);

  // ── 3. The whole store ───────────────────────────────────────────────────
  section("3. clearing everything");

  const result = await executeMassDelete(db, store.id, {});
  check("3 deleted, 1 kept", result.deleted === 3 && result.blocked === 1, JSON.stringify(result));
  check("comps went with their card", (await db.priceComp.count()) === 0);
  check("snapshots went too", (await db.priceSnapshot.count()) === 0);

  const left = await db.card.findMany();
  check(
    "only the sold card remains",
    left.length === 1 && left[0].name === "Was Sold",
    left.map((c) => c.name).join(", ")
  );
  check("its sale is intact", (await db.sale.count()) === 1);

  // ── 4. Numbering ─────────────────────────────────────────────────────────
  section("4. what happens to numbering");

  check(
    "the counter keeps climbing by default",
    result.nextLookupNumber === 6,
    String(result.nextLookupNumber)
  );

  // The sold card is still there, so a reset must be refused.
  const refusedReset = await executeMassDelete(db, store.id, {}, { resetNumbering: true });
  check(
    "reset is refused while any card remains",
    refusedReset.nextLookupNumber === 6,
    String(refusedReset.nextLookupNumber)
  );

  // Remove the sale, then the card, then the store really is empty.
  await db.sale.deleteMany({});
  const nowEmpty = await executeMassDelete(db, store.id, {}, { resetNumbering: true });
  check("with the store empty the reset applies", nowEmpty.nextLookupNumber === 1, String(nowEmpty.nextLookupNumber));
  check("store is empty", (await db.card.count()) === 0);

  // ── 5. Tenancy ───────────────────────────────────────────────────────────
  section("5. the other store");

  check("its card is untouched", (await otherDb.card.count()) === 1);
  check(
    "and still numbered 1",
    (await otherDb.card.findFirst())?.lookupNumber === 1
  );
  const otherPlan = await planMassDelete(otherDb, {});
  check("its own preview sees only its own card", otherPlan.matched === 1);

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
