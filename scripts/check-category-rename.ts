/**
 * Renames a category and asserts that everything holding its key moves with it.
 *
 *   docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=cards -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/cards \
 *   DIRECT_URL=postgresql://postgres:test@127.0.0.1:55432/cards npx prisma migrate deploy
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/check-category-rename.ts
 *
 * Run it against a throwaway database — it writes two stores' worth of fixtures.
 *
 * `Card.category` is a denormalised string with no foreign key, so a rename that
 * forgets it does not fail loudly: the cards simply stop appearing anywhere. That
 * silent-loss case is what most of these assertions are for.
 */
import { prisma } from "../src/lib/prisma";
import { storeDb } from "../src/lib/db/scoped";
import { buildDefaultCategoryRows } from "../src/lib/defaultCategories";
import { renameCategory, isRenameError, validateKey } from "../src/lib/categoryRename";

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

async function main() {
  const storeA = await makeStore("Rename Store");
  const storeB = await makeStore("Bystander Store");
  const dbA = storeDb(storeA.id);
  const dbB = storeDb(storeB.id);

  // Fixtures in store A: cards, a saved filter and an import template, all
  // referencing the NBA key the way the real app writes them.
  await dbA.card.createMany({
    data: [
      { storeId: storeA.id, lookupNumber: 1, category: "NBA", name: "Luka Doncic", series: "Prizm", costBasis: 1, askingPrice: 2 },
      { storeId: storeA.id, lookupNumber: 2, category: "NBA", name: "LeBron James", series: "Prizm", costBasis: 1, askingPrice: 2 },
      // Written with different casing, as an older import or a hand edit might.
      { storeId: storeA.id, lookupNumber: 3, category: "nba", name: "Stephen Curry", series: "Chrome", costBasis: 1, askingPrice: 2 },
      { storeId: storeA.id, lookupNumber: 4, category: "Football", name: "Erling Haaland", series: "Chrome", costBasis: 1, askingPrice: 2 },
    ],
  });
  await dbA.filterPreset.create({
    data: { storeId: storeA.id, name: "Cheap NBA", category: "NBA", filterJson: { status: "In Stock" } },
  });
  await dbA.importMapping.create({
    data: {
      storeId: storeA.id,
      name: "Seller sheet",
      headerSignature: "category|name",
      fieldMap: { category: "Sport", name: "Player" },
      categoryMap: { basketball: "NBA", soccer: "Football" },
    },
  });

  // Store B gets an NBA card too — renaming A's category must not touch it.
  await dbB.card.create({
    data: { storeId: storeB.id, lookupNumber: 1, category: "NBA", name: "Other Store Card", series: "Prizm", costBasis: 1, askingPrice: 2 },
  });

  const nba = await dbA.category.findFirst({ where: { key: "NBA" } });
  if (!nba) throw new Error("NBA category missing from fixtures");

  // ── 1. Display name only ─────────────────────────────────────────────────
  section("1. renaming only the display name");

  const labelOnly = await renameCategory(dbA, nba.id, { displayName: "Basketball Cards" });
  check("succeeded", !isRenameError(labelOnly));
  if (!isRenameError(labelOnly)) {
    check("nothing was migrated", labelOnly.cardsMoved === 0 && labelOnly.presetsMoved === 0);
    check("no warning raised", labelOnly.warnings.length === 0);
  }
  check(
    "cards still sit under the old key",
    (await dbA.card.count({ where: { category: { equals: "NBA", mode: "insensitive" } } })) === 3
  );
  check(
    "display name changed",
    (await dbA.category.findFirst({ where: { id: nba.id } }))?.displayName === "Basketball Cards"
  );

  // ── 2. Rejections ────────────────────────────────────────────────────────
  section("2. keys that must be refused");

  check('"all" is reserved', validateKey("all") !== null, validateKey("all") ?? "");
  check("a key with a slash is refused", validateKey("NBA/2023") !== null);
  check("a key with spaces is refused", validateKey("My Cards") !== null);
  check("a key starting with a dash is refused", validateKey("-nba") !== null);
  check("a normal key passes", validateKey("Basketball") === null);
  check("a dashed key passes", validateKey("TCG-MTG") === null);

  const collision = await renameCategory(dbA, nba.id, { key: "Football" });
  check(
    "colliding with an existing key is refused",
    isRenameError(collision) && collision.status === 409,
    isRenameError(collision) ? collision.error : "no error"
  );

  const reserved = await renameCategory(dbA, nba.id, { key: "all" });
  check("renaming to a reserved key is refused", isRenameError(reserved) && reserved.status === 400);

  check(
    "a refused rename changed nothing",
    (await dbA.category.findFirst({ where: { id: nba.id } }))?.key === "NBA"
  );

  // ── 3. The real key rename ───────────────────────────────────────────────
  section("3. renaming the key NBA -> Basketball");

  const renamed = await renameCategory(dbA, nba.id, { key: "Basketball", displayName: "Basketball" });
  check("succeeded", !isRenameError(renamed));
  if (isRenameError(renamed)) throw new Error(renamed.error);

  check("reported 3 cards moved", renamed.cardsMoved === 3, String(renamed.cardsMoved));
  check("reported 1 saved filter moved", renamed.presetsMoved === 1, String(renamed.presetsMoved));
  check("reported 1 import template updated", renamed.templatesUpdated === 1, String(renamed.templatesUpdated));

  check("category key changed", (await dbA.category.findFirst({ where: { id: nba.id } }))?.key === "Basketball");
  check(
    "no card is stranded on the old key",
    (await dbA.card.count({ where: { category: { equals: "NBA", mode: "insensitive" } } })) === 0
  );
  check(
    "all 3 cards carry the new key, including the lowercase one",
    (await dbA.card.count({ where: { category: "Basketball" } })) === 3
  );
  check(
    "the Football card was left alone",
    (await dbA.card.count({ where: { category: "Football" } })) === 1
  );
  check(
    "the saved filter follows the category",
    (await dbA.filterPreset.findFirst({ where: { name: "Cheap NBA" } }))?.category === "Basketball"
  );

  const template = await dbA.importMapping.findFirst({ where: { name: "Seller sheet" } });
  const map = (template?.categoryMap ?? {}) as Record<string, string>;
  check("import template remaps to the new key", map.basketball === "Basketball", JSON.stringify(map));
  check("its other entries are untouched", map.soccer === "Football", JSON.stringify(map));

  check(
    "renaming away from NBA warns that enrichment stops",
    renamed.warnings.length === 1 && renamed.warnings[0].includes("no longer run"),
    renamed.warnings.join(" ")
  );

  // ── 4. Tenancy ───────────────────────────────────────────────────────────
  section("4. the other store is untouched");

  check(
    "store B's NBA card kept its category",
    (await dbB.card.count({ where: { category: "NBA" } })) === 1
  );
  check(
    "store B still has its own NBA category",
    (await dbB.category.findFirst({ where: { key: "NBA" } })) !== null
  );
  check(
    "store B cannot rename store A's category",
    isRenameError(await renameCategory(dbB, nba.id, { key: "Hijacked" }))
  );

  // ── 5. Renaming back ─────────────────────────────────────────────────────
  section("5. renaming back restores enrichment");

  const back = await renameCategory(dbA, nba.id, { key: "NBA", displayName: "NBA" });
  check("succeeded", !isRenameError(back));
  if (!isRenameError(back)) {
    check("3 cards moved back", back.cardsMoved === 3, String(back.cardsMoved));
    check("no warning when moving back onto a supported key", back.warnings.length === 0, back.warnings.join(" "));
  }

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
