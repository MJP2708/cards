/**
 * Verifies re-aligning lookup numbers to a vendor's sheet.
 *
 *   docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=cards -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/cards \
 *   DIRECT_URL=postgresql://postgres:test@127.0.0.1:55432/cards npx prisma migrate deploy
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/check-renumber.ts
 *
 * Run it against a throwaway database — it writes a store's worth of fixtures.
 *
 * The dangerous case is a swap or a shift: moving a card onto a number another
 * card still holds transiently violates the unique index, so a naive one-pass
 * update corrupts the numbering halfway through. That is asserted directly, as
 * is the real-world shape that started this — a sheet whose numbering has gaps
 * and whose later rows were imported separately and landed at the end.
 */
import { prisma } from "../src/lib/prisma";
import { storeDb } from "../src/lib/db/scoped";
import { buildDefaultCategoryRows } from "../src/lib/defaultCategories";
import { getCategories } from "../src/lib/categories";
import { planRenumber, applyRenumber } from "../src/lib/import/renumber";
import type { RawRow } from "../src/lib/import/worksheet";

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures++;
}

function section(title: string) {
  console.log(`\n${title}\n${"─".repeat(title.length)}`);
}

const HEADERS = ["Lookup #", "Category", "Name", "Series/Set"];
const FIELD_MAP = {
  lookupNumber: "Lookup #",
  category: "Category",
  name: "Name",
  series: "Series/Set",
};
const CATEGORY_MAP = { nba: "NBA" };

function sheet(rows: [number | string, string, string][]): RawRow[] {
  return rows.map(([num, name, series], index) => ({
    rowNumber: index + 2,
    cells: [String(num), "NBA", name, series],
  }));
}

async function main() {
  const store = await prisma.store.create({ data: { name: "Renumber Store" } });
  await prisma.category.createMany({ data: buildDefaultCategoryRows(store.id) });
  const db = storeDb(store.id);
  const categories = await getCategories(db);

  // Inventory numbered consecutively 1..5, the way the backfill left it.
  const names: [string, string][] = [
    ["Ajay Mitchell", "Panini Prizm"],
    ["Victor Wembanyama", "Topps Midnight"],
    ["Cole Palmer", "Panini Prizm Black"],
    ["Manu Ginobili", "Panini Volcanic"],
    ["Cooper Flagg", "Panini Midnight"],
  ];
  await db.card.createMany({
    data: names.map(([name, series], index) => ({
      storeId: store.id,
      lookupNumber: index + 1,
      category: "NBA",
      name,
      series,
      costBasis: 1,
      askingPrice: 100 + index,
    })),
  });
  await prisma.store.update({ where: { id: store.id }, data: { nextLookupNumber: 6 } });

  const show = async (label: string) => {
    const cards = await db.card.findMany({ orderBy: { lookupNumber: "asc" } });
    console.log(`    ${label}: ` + cards.map((c) => `#${c.lookupNumber} ${c.name.split(" ")[0]}`).join("  "));
  };

  // ── 1. The real shape: gaps, and late rows belonging mid-list ────────────
  section("1. a sheet whose numbering has gaps");

  await show("before");

  // The vendor's own numbering: 1, 2, 3, then a gap, then 28 and 30.
  const vendorSheet = sheet([
    [1, "Ajay Mitchell", "Panini Prizm"],
    [2, "Victor Wembanyama", "Topps Midnight"],
    [3, "Cole Palmer", "Panini Prizm Black"],
    [28, "Cooper Flagg", "Panini Midnight"],
    [30, "Manu Ginobili", "Panini Volcanic"],
  ]);

  const plan = await planRenumber(db, categories, {
    headers: HEADERS,
    rows: vendorSheet,
    fieldMap: FIELD_MAP,
    categoryMap: CATEGORY_MAP,
  });

  check(
    "3 rows already correct, 2 need renumbering",
    plan.summary.alreadyCorrect === 3 && plan.summary.renumber === 2,
    JSON.stringify(plan.summary)
  );
  check("nothing unmatched", plan.summary.notFound === 0 && plan.summary.conflict === 0);
  check("no card left unclaimed", plan.untouched.length === 0, JSON.stringify(plan.untouched));

  const before = await db.card.findMany({ orderBy: { lookupNumber: "asc" } });
  check("planning wrote nothing", before.map((c) => c.lookupNumber).join(",") === "1,2,3,4,5");

  const assignments = plan.rows
    .filter((r) => r.status === "renumber" && r.card && r.lookupNumber !== null)
    .map((r) => ({ cardId: r.card!.id, lookupNumber: r.lookupNumber! }));
  await applyRenumber(db, store.id, assignments);
  await show("after ");

  const flagg = await db.card.findFirst({ where: { name: "Cooper Flagg" } });
  const ginobili = await db.card.findFirst({ where: { name: "Manu Ginobili" } });
  check("Cooper Flagg took the sheet's #28", flagg?.lookupNumber === 28, String(flagg?.lookupNumber));
  check("Manu Ginobili took the sheet's #30", ginobili?.lookupNumber === 30, String(ginobili?.lookupNumber));
  check(
    "the counter moved past the highest assigned",
    (await prisma.store.findUnique({ where: { id: store.id } }))?.nextLookupNumber === 31
  );
  check(
    "nothing else changed",
    (await db.card.findFirst({ where: { name: "Ajay Mitchell" } }))?.lookupNumber === 1
  );

  // ── 2. A straight swap ───────────────────────────────────────────────────
  section("2. swapping two numbers");

  const swap = await planRenumber(db, categories, {
    headers: HEADERS,
    rows: sheet([
      [2, "Ajay Mitchell", "Panini Prizm"],
      [1, "Victor Wembanyama", "Topps Midnight"],
    ]),
    fieldMap: FIELD_MAP,
    categoryMap: CATEGORY_MAP,
  });
  check("both rows plan a renumber", swap.summary.renumber === 2, JSON.stringify(swap.summary));

  await applyRenumber(
    db,
    store.id,
    swap.rows
      .filter((r) => r.status === "renumber" && r.card && r.lookupNumber !== null)
      .map((r) => ({ cardId: r.card!.id, lookupNumber: r.lookupNumber! }))
  );
  await show("after ");
  check(
    "the swap completed without tripping the unique index",
    (await db.card.findFirst({ where: { name: "Ajay Mitchell" } }))?.lookupNumber === 2 &&
      (await db.card.findFirst({ where: { name: "Victor Wembanyama" } }))?.lookupNumber === 1
  );
  check("no card was left parked on a negative number", (await db.card.count({ where: { lookupNumber: { lt: 1 } } })) === 0);

  // ── 3. A shift, where every target is still held ─────────────────────────
  section("3. shifting a whole run down by one");

  await db.card.deleteMany({});
  await db.card.createMany({
    data: [10, 11, 12, 13].map((n, i) => ({
      storeId: store.id,
      lookupNumber: n,
      category: "NBA",
      name: `Shift ${i}`,
      series: "Set",
      costBasis: 1,
      askingPrice: 1,
    })),
  });

  const shift = await planRenumber(db, categories, {
    headers: HEADERS,
    rows: sheet([
      [9, "Shift 0", "Set"],
      [10, "Shift 1", "Set"],
      [11, "Shift 2", "Set"],
      [12, "Shift 3", "Set"],
    ]),
    fieldMap: FIELD_MAP,
    categoryMap: CATEGORY_MAP,
  });
  await applyRenumber(
    db,
    store.id,
    shift.rows
      .filter((r) => r.status === "renumber" && r.card && r.lookupNumber !== null)
      .map((r) => ({ cardId: r.card!.id, lookupNumber: r.lookupNumber! }))
  );
  const shifted = await db.card.findMany({ orderBy: { lookupNumber: "asc" } });
  check(
    "every card moved down one, none collided",
    shifted.map((c) => `${c.name}=${c.lookupNumber}`).join(" ") ===
      "Shift 0=9 Shift 1=10 Shift 2=11 Shift 3=12",
    shifted.map((c) => `${c.name}=${c.lookupNumber}`).join(" ")
  );

  // ── 4. Rows the sheet gets wrong ─────────────────────────────────────────
  section("4. rows that cannot be renumbered");

  const messy = await planRenumber(db, categories, {
    headers: HEADERS,
    rows: sheet([
      [99, "Nobody Here", "Set"],
      ["", "Shift 0", "Set"],
      ["abc", "Shift 1", "Set"],
      [5, "Shift 2", "Set"],
      [5, "Shift 3", "Set"],
    ]),
    fieldMap: FIELD_MAP,
    categoryMap: CATEGORY_MAP,
  });

  check("a card that isn't in inventory is reported, not invented", messy.summary.notFound === 1);
  check("a blank and an unreadable number are both invalid", messy.summary.invalid === 3, JSON.stringify(messy.summary));
  check(
    "the second row claiming #5 is rejected, the first is kept",
    messy.rows.filter((r) => r.lookupNumber === 5 && r.status === "renumber").length === 1 &&
      messy.rows.some((r) => r.status === "invalid" && r.note.includes("also used by row"))
  );
  // Shift 2 is the only card any usable row claimed; the rows naming Shift 0, 1
  // and 3 were all rejected, so those cards must remain unclaimed rather than
  // being quietly consumed by a row that could not be acted on.
  check(
    "rejected rows do not consume the card they named",
    messy.untouched.length === 3 &&
      messy.untouched.every((u) => u.name !== "Shift 2"),
    messy.untouched.map((u) => `${u.name}#${u.currentNumber}`).join(" ")
  );

  // ── 5. Ambiguity is refused, not guessed ─────────────────────────────────
  section("5. two identical cards");

  await db.card.deleteMany({});
  await db.card.createMany({
    data: [1, 2].map((n) => ({
      storeId: store.id,
      lookupNumber: n,
      category: "NBA",
      name: "Twin Card",
      series: "Same Set",
      costBasis: 1,
      askingPrice: 1,
    })),
  });

  // One row for two identical cards: the first card pairs, the second is simply
  // not mentioned by the sheet and keeps its number.
  const oneRow = await planRenumber(db, categories, {
    headers: HEADERS,
    rows: sheet([[50, "Twin Card", "Same Set"]]),
    fieldMap: FIELD_MAP,
    categoryMap: CATEGORY_MAP,
  });
  check("one row pairs with one of the twins", oneRow.summary.renumber === 1, JSON.stringify(oneRow.summary));
  check(
    "and says it was paired by position, since they are indistinguishable",
    oneRow.rows[0].note.includes("identical cards"),
    oneRow.rows[0].note
  );
  check("the unmentioned twin is listed as untouched", oneRow.untouched.length === 1);

  // Two rows for two identical cards: both pair, in file order.
  const bothRows = await planRenumber(db, categories, {
    headers: HEADERS,
    rows: sheet([
      [50, "Twin Card", "Same Set"],
      [51, "Twin Card", "Same Set"],
    ]),
    fieldMap: FIELD_MAP,
    categoryMap: CATEGORY_MAP,
  });
  check("both rows pair rather than blocking each other", bothRows.summary.renumber === 2, JSON.stringify(bothRows.summary));
  await applyRenumber(
    db,
    store.id,
    bothRows.rows
      .filter((r) => r.status === "renumber" && r.card && r.lookupNumber !== null)
      .map((r) => ({ cardId: r.card!.id, lookupNumber: r.lookupNumber! }))
  );
  check(
    "the twins took #50 and #51",
    (await db.card.findMany({ orderBy: { lookupNumber: "asc" } })).map((c) => c.lookupNumber).join(",") === "50,51"
  );

  // More rows than cards: the surplus is reported rather than invented.
  const tooMany = await planRenumber(db, categories, {
    headers: HEADERS,
    rows: sheet([
      [60, "Twin Card", "Same Set"],
      [61, "Twin Card", "Same Set"],
      [62, "Twin Card", "Same Set"],
    ]),
    fieldMap: FIELD_MAP,
    categoryMap: CATEGORY_MAP,
  });
  check("a third row with only two cards is not_found", tooMany.summary.notFound === 1, JSON.stringify(tooMany.summary));

  // ── 6. A target held by a card that isn't moving ─────────────────────────
  section("6. wanting a number another card still holds");

  await db.card.deleteMany({});
  await db.card.createMany({
    data: [
      { storeId: store.id, lookupNumber: 5, category: "NBA", name: "Stays Put", series: "Set A", costBasis: 1, askingPrice: 1 },
      { storeId: store.id, lookupNumber: 9, category: "NBA", name: "Wants Five", series: "Set B", costBasis: 1, askingPrice: 1 },
    ],
  });

  // Only "Wants Five" is in the sheet. It asks for #5, which "Stays Put" holds
  // and nothing moves — this is the shape that blew up on the real 220-card run.
  const blocked = await planRenumber(db, categories, {
    headers: HEADERS,
    rows: sheet([[5, "Wants Five", "Set B"]]),
    fieldMap: FIELD_MAP,
    categoryMap: CATEGORY_MAP,
  });
  check("the blocked row is reported as a conflict", blocked.summary.conflict === 1, JSON.stringify(blocked.summary));
  check("nothing is planned as a renumber", blocked.summary.renumber === 0);
  check(
    "and the blocking card is named so it can be resolved",
    blocked.rows[0].note.includes("Stays Put"),
    blocked.rows[0].note
  );

  await applyRenumber(
    db,
    store.id,
    blocked.rows
      .filter((r) => r.status === "renumber" && r.card && r.lookupNumber !== null)
      .map((r) => ({ cardId: r.card!.id, lookupNumber: r.lookupNumber! }))
  );
  check(
    "applying changed nothing rather than throwing",
    (await db.card.findMany({ orderBy: { lookupNumber: "asc" } })).map((c) => c.lookupNumber).join(",") === "5,9"
  );

  // When the blocker *is* moving, the same shape is fine.
  const chain = await planRenumber(db, categories, {
    headers: HEADERS,
    rows: sheet([
      [9, "Stays Put", "Set A"],
      [5, "Wants Five", "Set B"],
    ]),
    fieldMap: FIELD_MAP,
    categoryMap: CATEGORY_MAP,
  });
  check("a mutual swap is allowed, not flagged", chain.summary.conflict === 0 && chain.summary.renumber === 2);
  await applyRenumber(
    db,
    store.id,
    chain.rows
      .filter((r) => r.status === "renumber" && r.card && r.lookupNumber !== null)
      .map((r) => ({ cardId: r.card!.id, lookupNumber: r.lookupNumber! }))
  );
  check(
    "and it completes",
    (await db.card.findFirst({ where: { name: "Wants Five" } }))?.lookupNumber === 5 &&
      (await db.card.findFirst({ where: { name: "Stays Put" } }))?.lookupNumber === 9
  );

  // ── 7. Evicting a blocker ────────────────────────────────────────────────
  section("7. a card the file never mentions, sitting on a needed number");

  await db.card.deleteMany({});
  await db.card.createMany({
    data: [
      { storeId: store.id, lookupNumber: 1, category: "NBA", name: "In The File", series: "Set A", costBasis: 1, askingPrice: 1 },
      { storeId: store.id, lookupNumber: 2, category: "NBA", name: "Not In File", series: "Set B", costBasis: 1, askingPrice: 1 },
    ],
  });

  const input = {
    headers: HEADERS,
    rows: sheet([[2, "In The File", "Set A"]]),
    fieldMap: FIELD_MAP,
    categoryMap: CATEGORY_MAP,
  };

  const without = await planRenumber(db, categories, input);
  check("without eviction it is a conflict", without.summary.conflict === 1, JSON.stringify(without.summary));
  check("and the blocker is identified with somewhere to go", without.blockers.length === 1 && without.blockers[0].proposedNumber === 3,
    JSON.stringify(without.blockers));

  const withEviction = await planRenumber(db, categories, { ...input, evictBlockers: true });
  check("ticking eviction clears the conflict", withEviction.summary.conflict === 0 && withEviction.summary.renumber === 1,
    JSON.stringify(withEviction.summary));

  await applyRenumber(
    db,
    store.id,
    withEviction.rows
      .filter((r) => r.status === "renumber" && r.card && r.lookupNumber !== null)
      .map((r) => ({ cardId: r.card!.id, lookupNumber: r.lookupNumber! })),
    withEviction.blockers.map((b) => ({ cardId: b.id, lookupNumber: b.proposedNumber }))
  );
  const evicted = await db.card.findMany({ orderBy: { lookupNumber: "asc" } });
  check(
    "the file's card took #2 and the blocker moved to the end",
    evicted.map((c) => `${c.name}=${c.lookupNumber}`).join(" ") === "In The File=2 Not In File=3",
    evicted.map((c) => `${c.name}=${c.lookupNumber}`).join(" ")
  );
  check("no duplicates and nothing parked negative",
    new Set(evicted.map((c) => c.lookupNumber)).size === evicted.length &&
      evicted.every((c) => c.lookupNumber > 0));

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
