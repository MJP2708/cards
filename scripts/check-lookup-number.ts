/**
 * Verifies the store-assigned quick-reference numbering.
 *
 *   docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=cards -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/cards \
 *   DIRECT_URL=postgresql://postgres:test@127.0.0.1:55432/cards npx prisma migrate deploy
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/check-lookup-number.ts
 *
 * Run it against a throwaway database — it writes two stores' worth of fixtures.
 *
 * The two guarantees that matter are the ones a spreadsheet cannot give you:
 * a number is never reused after a deletion, and two people adding cards at the
 * same moment never get the same one. Both are asserted directly.
 */
import { prisma } from "../src/lib/prisma";
import { storeDb } from "../src/lib/db/scoped";
import { buildDefaultCategoryRows } from "../src/lib/defaultCategories";
import {
  allocateLookupNumber,
  allocateLookupNumbers,
  parseLookupNumber,
  reserveLookupNumberAtLeast,
} from "../src/lib/lookupNumber";
import { commitImport } from "../src/lib/import/commit";
import type { CardInput } from "../src/lib/validation/card";

/** The minimum a Card row needs, for fixtures written straight to the database. */
const CARD_DEFAULTS = {
  category: "NBA",
  series: "2023 Panini Prizm",
  costBasis: 100,
  askingPrice: 200,
  quantity: 1,
  status: "In Stock",
} as const;

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures++;
}

function section(title: string) {
  console.log(`\n${title}\n${"─".repeat(title.length)}`);
}

async function makeStore(name: string) {
  const store = await prisma.store.create({ data: { name } });
  await prisma.category.createMany({ data: buildDefaultCategoryRows(store.id) });
  return store;
}

/** A committable row for the importer. */
function card(name: string): CardInput {
  return { ...CARD_DEFAULTS, name } as CardInput;
}

async function main() {
  const storeA = await makeStore("Numbering Store");
  const storeB = await makeStore("Bystander Store");
  const dbA = storeDb(storeA.id);
  const dbB = storeDb(storeB.id);

  // ── 1. Sequence ──────────────────────────────────────────────────────────
  section("1. sequential allocation");

  const first = await allocateLookupNumber(dbA, storeA.id);
  const second = await allocateLookupNumber(dbA, storeA.id);
  const third = await allocateLookupNumber(dbA, storeA.id);
  check("first card gets 1", first === 1, String(first));
  check("then 2 and 3", second === 2 && third === 3, `${second}, ${third}`);

  const block = await allocateLookupNumbers(dbA, storeA.id, 4);
  check("a block is consecutive and continues", JSON.stringify(block) === "[4,5,6,7]", JSON.stringify(block));
  check("asking for none allocates none", (await allocateLookupNumbers(dbA, storeA.id, 0)).length === 0);

  // ── 2. Per store, not global ─────────────────────────────────────────────
  section("2. numbering is per store");

  const bFirst = await allocateLookupNumber(dbB, storeB.id);
  check("a second store starts again at 1", bFirst === 1, String(bFirst));
  check(
    "and store A is unaffected",
    (await allocateLookupNumber(dbA, storeA.id)) === 8
  );

  // ── 3. Never reused ──────────────────────────────────────────────────────
  section("3. numbers are never reused");

  const doomed = await dbA.card.create({
    data: { storeId: storeA.id, lookupNumber: 100, name: "Doomed Card", ...CARD_DEFAULTS },
  });
  await reserveLookupNumberAtLeast(dbA, storeA.id, 100);
  const afterReserve = await allocateLookupNumber(dbA, storeA.id);
  check("counter moved past a manually-set high number", afterReserve === 101, String(afterReserve));

  await dbA.card.delete({ where: { id: doomed.id } });
  const afterDelete = await allocateLookupNumber(dbA, storeA.id);
  check(
    "deleting the highest card does not recycle its number",
    afterDelete === 102,
    `got ${afterDelete}, and #100 is gone: ${(await dbA.card.count({ where: { lookupNumber: 100 } })) === 0}`
  );
  check(
    "the gap is left behind rather than backfilled",
    (await dbA.card.count({ where: { lookupNumber: 100 } })) === 0
  );

  // ── 4. Concurrency ───────────────────────────────────────────────────────
  section("4. two people adding cards at once");

  const parallel = await Promise.all(
    Array.from({ length: 25 }, () => allocateLookupNumber(dbA, storeA.id))
  );
  const unique = new Set(parallel);
  check(
    "25 simultaneous allocations produced 25 distinct numbers",
    unique.size === 25,
    `${unique.size} distinct of ${parallel.length}`
  );
  check(
    "and they form one unbroken run",
    Math.max(...parallel) - Math.min(...parallel) === 24,
    `${Math.min(...parallel)}..${Math.max(...parallel)}`
  );

  // The unique index is the real backstop, so prove it actually rejects a clash.
  await dbA.card.create({ data: { storeId: storeA.id, lookupNumber: 900, name: "Holder", ...CARD_DEFAULTS } });
  let rejected = false;
  try {
    await dbA.card.create({ data: { storeId: storeA.id, lookupNumber: 900, name: "Clasher", ...CARD_DEFAULTS } });
  } catch {
    rejected = true;
  }
  check("the database refuses a duplicate number within a store", rejected);

  // ── 5. Import: supplied numbers are kept ─────────────────────────────────
  section("5. importing a sheet that already has numbers");

  const storeC = await makeStore("Import Store");
  const dbC = storeDb(storeC.id);

  const supplied = await commitImport(dbC, storeC.id, {
    fileName: "numbered.csv",
    rows: [
      { card: card("Vendor 10"), lookupNumber: 10, action: "new" },
      { card: card("Vendor 11"), lookupNumber: 11, action: "new" },
      { card: card("Vendor 12"), lookupNumber: 12, action: "new" },
    ],
  });
  check("imported 3 rows", supplied.created === 3);

  const numbered = await dbC.card.findMany({ orderBy: { lookupNumber: "asc" } });
  check(
    "the sheet's own numbers were preserved, not overwritten",
    numbered.map((c) => c.lookupNumber).join(",") === "10,11,12",
    numbered.map((c) => `${c.lookupNumber}:${c.name}`).join(" ")
  );

  const afterSupplied = await allocateLookupNumber(dbC, storeC.id);
  check(
    "the next card continues past the imported numbers",
    afterSupplied === 13,
    String(afterSupplied)
  );

  // ── 6. Import: numbers assigned when absent ──────────────────────────────
  section("6. importing a sheet with no number column");

  const auto = await commitImport(dbC, storeC.id, {
    fileName: "unnumbered.csv",
    rows: [
      { card: card("Auto A"), action: "new" },
      { card: card("Auto B"), action: "new" },
    ],
  });
  check("imported 2 rows", auto.created === 2);

  const autoCards = await dbC.card.findMany({
    where: { name: { startsWith: "Auto" } },
    orderBy: { lookupNumber: "asc" },
  });
  check(
    "they were numbered in row order, continuing the store's sequence",
    autoCards.map((c) => `${c.name}=${c.lookupNumber}`).join(" ") === "Auto A=14 Auto B=15",
    autoCards.map((c) => `${c.name}=${c.lookupNumber}`).join(" ")
  );

  // ── 7. A mixed sheet ─────────────────────────────────────────────────────
  section("7. a sheet where only some rows carry a number");

  const mixed = await commitImport(dbC, storeC.id, {
    fileName: "mixed.csv",
    rows: [
      { card: card("Mixed supplied"), lookupNumber: 500, action: "new" },
      { card: card("Mixed auto"), action: "new" },
    ],
  });
  check("imported 2 rows", mixed.created === 2);
  check(
    "the supplied one kept 500",
    (await dbC.card.findFirst({ where: { name: "Mixed supplied" } }))?.lookupNumber === 500
  );
  const mixedAuto = await dbC.card.findFirst({ where: { name: "Mixed auto" } });
  check(
    "the unnumbered one got the next sequential number, not 501",
    mixedAuto?.lookupNumber === 16,
    String(mixedAuto?.lookupNumber)
  );
  check(
    "and the counter then moved past the supplied 500",
    (await allocateLookupNumber(dbC, storeC.id)) === 501
  );

  // ── 8. Parsing what a person types ───────────────────────────────────────
  section("8. parsing typed input");

  check('"47" parses', parseLookupNumber("47") === 47);
  check('"#47" parses', parseLookupNumber("#47") === 47);
  check('" 47 " parses', parseLookupNumber(" 47 ") === 47);
  check('"abc" does not', parseLookupNumber("abc") === null);
  check('"0" does not', parseLookupNumber("0") === null);
  check('"-3" does not', parseLookupNumber("-3") === null);
  check('"4.5" does not', parseLookupNumber("4.5") === null);
  check("empty does not", parseLookupNumber("") === null);

  // ── 9. Scoping ───────────────────────────────────────────────────────────
  section("9. one store cannot see another's numbering");

  await dbB.card.create({ data: { storeId: storeB.id, lookupNumber: 900, name: "B's 900", ...CARD_DEFAULTS } });
  check(
    "both stores can hold a card numbered 900",
    (await dbA.card.count({ where: { lookupNumber: 900 } })) === 1 &&
      (await dbB.card.count({ where: { lookupNumber: 900 } })) === 1
  );
  check(
    "looking up 900 in store B returns B's card",
    (await dbB.card.findFirst({ where: { lookupNumber: 900 } }))?.name === "B's 900"
  );

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
