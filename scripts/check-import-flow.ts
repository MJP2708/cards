/**
 * Walks two differently-shaped spreadsheets through the whole import pipeline and
 * asserts what happens at each step.
 *
 *   docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=cards -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/cards \
 *   DIRECT_URL=postgresql://postgres:test@127.0.0.1:55432/cards npx prisma migrate deploy
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/check-import-flow.ts
 *
 * Run it against a throwaway database — it writes two stores' worth of fixtures.
 *
 * The two fixtures are the point. `seller-a-familiar.csv` uses roughly the
 * vocabulary this app would pick itself; `seller-b-different.xlsx` renames and
 * reorders every column, and overlaps seller A's cards, so the same run covers
 * both halves of the feature: mapping an unknown sheet, and working out which of
 * its rows the store already owns.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { storeDb } from "../src/lib/db/scoped";
import { buildDefaultCategoryRows } from "../src/lib/defaultCategories";
import { getCategories } from "../src/lib/categories";
import { parseWorksheet } from "../src/lib/import/worksheet";
import { buildFieldCatalog } from "../src/lib/import/fields";
import {
  distinctColumnValues,
  headerSignature,
  signatureSimilarity,
  suggestCategoryValues,
  suggestMapping,
  suggestionsToFieldMap,
  TEMPLATE_MATCH_SCORE,
  type FieldMap,
} from "../src/lib/import/mapping";
import { stageRows, type MatchStatus, type StagedImport } from "../src/lib/import/stage";
import { commitImport, type CommitRow } from "../src/lib/import/commit";

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures++;
}

function section(title: string) {
  console.log(`\n${title}\n${"─".repeat(title.length)}`);
}

const FIXTURES = path.join(import.meta.dirname, "fixtures");

async function makeStore(name: string) {
  const store = await prisma.store.create({ data: { name } });
  await prisma.category.createMany({ data: buildDefaultCategoryRows(store.id) });
  return store;
}

/** Everything the wizard does between "file chosen" and "staging screen rendered". */
async function runWizard(db: ReturnType<typeof storeDb>, fileName: string, overrides?: FieldMap) {
  const buffer = await readFile(path.join(FIXTURES, fileName));
  const parsed = await parseWorksheet({
    name: fileName,
    buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  });

  const categories = await getCategories(db);
  const fields = buildFieldCatalog(categories);
  const suggestions = suggestMapping(parsed.headers, fields);
  const fieldMap: FieldMap = { ...suggestionsToFieldMap(suggestions), ...overrides };

  const values = distinctColumnValues(parsed.headers, parsed.rows, fieldMap.category ?? null);
  const categorySuggestions = suggestCategoryValues(values, categories);
  const categoryMap: Record<string, string> = {};
  for (const suggestion of categorySuggestions) {
    if (suggestion.categoryKey) categoryMap[suggestion.value.toLowerCase()] = suggestion.categoryKey;
  }

  const staged = await stageRows(db, categories, {
    headers: parsed.headers,
    rows: parsed.rows,
    fieldMap,
    categoryMap,
  });

  return { parsed, fields, suggestions, fieldMap, categorySuggestions, categoryMap, staged };
}

function rowByName(staged: StagedImport, name: string) {
  return staged.rows.find((row) => row.card?.name === name);
}

function matchOf(staged: StagedImport, name: string): MatchStatus | "missing" {
  return rowByName(staged, name)?.match ?? "missing";
}

/** Commits every row at its own suggested action, which is what "accept the defaults" means. */
function acceptSuggestions(staged: StagedImport): CommitRow[] {
  return staged.rows
    .filter((row) => row.card !== null)
    .map((row) => ({
      card: row.card!,
      action: row.suggestedAction === "undecided" ? ("skip" as const) : row.suggestedAction,
      existingId: row.existing?.id ?? null,
      needsReview: row.issues.length > 0 || row.match === "possible",
      reviewReason: row.issues.join("; ") || null,
    }));
}

async function main() {
  const storeA = await makeStore("Seller A Cards");
  const storeB = await makeStore("Seller B Cards");
  const dbA = storeDb(storeA.id);
  const dbB = storeDb(storeB.id);

  // ── 1. A sheet in roughly the app's own vocabulary ────────────────────────
  section("1. seller-a-familiar.csv into an empty store");

  const a = await runWizard(dbA, "seller-a-familiar.csv");
  check("read all 13 columns", a.parsed.headers.length === 13, a.parsed.headers.join(", "));
  check("read 5 data rows", a.parsed.rows.length === 5);

  const aMapped = Object.entries(a.fieldMap).filter(([, header]) => header);
  check(
    "auto-mapped name/category/series/price without help",
    a.fieldMap.name === "Name" &&
      a.fieldMap.category === "Category" &&
      a.fieldMap.series === "Series/Set" &&
      a.fieldMap.askingPrice === "Asking Price (THB)",
    `${aMapped.length} of ${a.fields.length} fields mapped`
  );
  check(
    'unit note in "Cost Basis (THB)" did not break matching',
    a.fieldMap.costBasis === "Cost Basis (THB)"
  );
  check('"Team" mapped to the category attribute', a.fieldMap.team === "Team");

  check(
    "category values matched exactly",
    a.categorySuggestions.every((s) => s.score >= 0.999),
    a.categorySuggestions.map((s) => `${s.value}->${s.categoryKey}`).join(", ")
  );

  check(
    "every row staged as new",
    a.staged.summary.new === 5 && a.staged.summary.failed === 0,
    JSON.stringify(a.staged.summary)
  );

  const beforeCommit = await dbA.card.count();
  check("staging wrote nothing to the database", beforeCommit === 0);

  const aCommit = await commitImport(dbA, storeA.id, {
    fileName: "seller-a-familiar.csv",
    rows: acceptSuggestions(a.staged),
    saveTemplate: {
      name: "Seller A sheet",
      headerSignature: headerSignature(a.parsed.headers),
      fieldMap: a.fieldMap,
      categoryMap: a.categoryMap,
    },
  });
  check("committed 5 new cards", aCommit.created === 5, JSON.stringify(aCommit));
  check("store A now holds 5 cards", (await dbA.card.count()) === 5);

  // ── 2. A sheet that shares nothing but the data ───────────────────────────
  section("2. seller-b-different.xlsx into the SAME store");

  const b = await runWizard(dbB, "seller-b-different.xlsx"); // warm-up parse on a clean store
  check("picked the only sheet even though it is not named Inventory", b.parsed.sheetName === "Stock List");

  const bA = await runWizard(dbA, "seller-b-different.xlsx");
  check("read all 13 renamed columns", bA.parsed.headers.length === 13, bA.parsed.headers.join(", "));

  check('"Player Name" -> name', bA.fieldMap.name === "Player Name");
  check('"Sport" -> category', bA.fieldMap.category === "Sport");
  check('"Set Name" -> series', bA.fieldMap.series === "Set Name");
  check('"Yr" -> year', bA.fieldMap.year === "Yr");
  check('"Condition" -> grade', bA.fieldMap.grade === "Condition");
  check('"On Hand" -> quantity', bA.fieldMap.quantity === "On Hand");
  check('"Availability" -> status', bA.fieldMap.status === "Availability");
  check('"Club" -> team', bA.fieldMap.team === "Club");
  check('"Remarks" -> notes', bA.fieldMap.buyerNote === "Remarks");
  check(
    '"Stock #" read as a SKU, not as a quantity',
    bA.fieldMap.qrCode === "Stock #" && bA.fieldMap.quantity !== "Stock #",
    `qrCode=${bA.fieldMap.qrCode}`
  );
  check('"Card #" -> card number', bA.fieldMap.cardNumber === "Card #");
  check(
    '"List Price" and "Purchase Price" were not both given to asking price',
    bA.fieldMap.askingPrice === "List Price" && bA.fieldMap.costBasis === "Purchase Price",
    `asking=${bA.fieldMap.askingPrice}, cost=${bA.fieldMap.costBasis}`
  );

  const basketball = bA.categorySuggestions.find((s) => s.value === "Basketball");
  const soccer = bA.categorySuggestions.find((s) => s.value === "Soccer");
  const baseball = bA.categorySuggestions.find((s) => s.value === "Baseball");
  check('"Basketball" resolved to NBA', basketball?.categoryKey === "NBA");
  check('"Soccer" resolved to Football', soccer?.categoryKey === "Football");
  check(
    '"Baseball" left unresolved rather than guessed',
    baseball !== undefined && baseball.categoryKey === null
  );

  section("   deduplication verdicts");
  check("Luka Doncic — identical to stock", matchOf(bA.staged, "Luka Doncic") === "exact_unchanged");
  check(
    "Victor Wembanyama — same card, changed",
    matchOf(bA.staged, "Victor Wembanyama") === "exact_changed"
  );
  check(
    "Erling Haaland — same card, status changed",
    matchOf(bA.staged, "Erling Haaland") === "exact_changed"
  );
  check(
    "Jayson Tatum — grade differs, flagged not decided",
    matchOf(bA.staged, "Jayson Tatum") === "possible"
  );
  check("Anthony Edwards — genuinely new", matchOf(bA.staged, "Anthony Edwards") === "new");
  check(
    "Shohei Ohtani — unresolved category cannot import",
    bA.staged.rows.some((row) => row.match === "failed" && row.issues.join(" ").includes("Baseball"))
  );

  const wemby = rowByName(bA.staged, "Victor Wembanyama");
  check(
    "Wembanyama's diff names quantity and price",
    wemby?.changes.some((c) => c.field === "quantity" && c.from === "2" && c.to === "5") === true &&
      wemby?.changes.some((c) => c.field === "askingPrice" && c.from === "28000" && c.to === "26500") === true,
    JSON.stringify(wemby?.changes)
  );
  check("Wembanyama defaults to updating, not duplicating", wemby?.suggestedAction === "update");
  check(
    "Doncic defaults to skip",
    rowByName(bA.staged, "Luka Doncic")?.suggestedAction === "skip"
  );
  check(
    "Tatum is left undecided for a human",
    rowByName(bA.staged, "Jayson Tatum")?.suggestedAction === "undecided"
  );

  const repeated = bA.staged.rows.filter((row) => row.card?.name === "Anthony Edwards");
  check("both Anthony Edwards rows survived to staging", repeated.length === 2);
  check(
    "the second one is flagged as a repeat of the first",
    repeated[1]?.match === "possible" &&
      repeated[1].issues.join(" ").includes(`Row ${repeated[0]?.rowNumber}`),
    repeated[1]?.issues.join(" ")
  );

  const banchero = rowByName(bA.staged, "Paolo Banchero");
  check(
    "missing price/cost defaulted to 0 and flagged, not rejected",
    banchero?.match === "new" &&
      banchero.card?.askingPrice === 0 &&
      banchero.card?.costBasis === 0 &&
      banchero.issues.some((i) => i.includes("Asking Price")) &&
      banchero.issues.some((i) => i.includes("Cost Basis")),
    banchero?.issues.join(" ")
  );
  check("blank quantity defaulted to 1", banchero?.card?.quantity === 1);
  check("blank status defaulted to In Stock", banchero?.card?.status === "In Stock");

  section("   committing seller B's sheet");
  const countBefore = await dbA.card.count();
  const bCommit = await commitImport(dbA, storeA.id, {
    fileName: "seller-b-different.xlsx",
    rows: acceptSuggestions(bA.staged),
  });
  // Seven rows reach commit, not eight: the Ohtani row failed staging and so has no
  // card to send. Of the seven, Doncic and the two undecided rows are the skips.
  check(
    "2 created, 2 updated, 3 skipped",
    bCommit.created === 2 && bCommit.updated === 2 && bCommit.skipped === 3,
    JSON.stringify(bCommit)
  );

  const countAfter = await dbA.card.count();
  check(
    "re-importing overlapping cards did not double inventory",
    countAfter === countBefore + 2,
    `${countBefore} -> ${countAfter}`
  );

  const storedWemby = await dbA.card.findFirst({ where: { name: "Victor Wembanyama" } });
  check(
    "Wembanyama was updated in place, not duplicated",
    (await dbA.card.count({ where: { name: "Victor Wembanyama" } })) === 1 &&
      storedWemby?.quantity === 5 &&
      storedWemby?.askingPrice === 26500,
    `qty=${storedWemby?.quantity}, price=${storedWemby?.askingPrice}`
  );

  const storedDoncic = await dbA.card.findFirst({ where: { name: "Luka Doncic" } });
  check(
    "the identical Doncic row changed nothing",
    (await dbA.card.count({ where: { name: "Luka Doncic" } })) === 1 &&
      storedDoncic?.quantity === 1 &&
      storedDoncic?.askingPrice === 9900
  );
  check(
    "Tatum was not silently resolved either way",
    (await dbA.card.count({ where: { name: "Jayson Tatum" } })) === 1
  );
  check("Ohtani was never written", (await dbA.card.count({ where: { name: "Shohei Ohtani" } })) === 0);

  // ── 3. Tenancy ───────────────────────────────────────────────────────────
  section("3. the same sheet into a DIFFERENT store");

  const bInB = await runWizard(dbB, "seller-b-different.xlsx");
  check(
    "store B sees no matches against store A's inventory",
    bInB.staged.summary.exactUnchanged === 0 && bInB.staged.summary.exactChanged === 0,
    JSON.stringify(bInB.staged.summary)
  );
  check(
    "only the in-file repeat is flagged for store B",
    bInB.staged.summary.possible === 1 && bInB.staged.summary.new === 6,
    JSON.stringify(bInB.staged.summary)
  );
  check("store A's card count is untouched by store B's staging", (await dbA.card.count()) === countAfter);

  // ── 4. Saved mapping templates ───────────────────────────────────────────
  section("4. reusable mapping templates");

  const templates = await dbA.importMapping.findMany();
  check("seller A's mapping was saved", templates.length === 1 && templates[0].name === "Seller A sheet");
  check("store B cannot see it", (await dbB.importMapping.findMany()).length === 0);

  const savedSignature = templates[0]?.headerSignature ?? "";
  const sameSheetAgain = headerSignature(
    (await parseWorksheet({
      name: "seller-a-familiar.csv",
      buffer: (await readFile(path.join(FIXTURES, "seller-a-familiar.csv"))).buffer as ArrayBuffer,
    })).headers
  );
  check(
    "re-uploading the same sheet matches the saved template",
    signatureSimilarity(savedSignature, sameSheetAgain) >= TEMPLATE_MATCH_SCORE,
    `similarity ${signatureSimilarity(savedSignature, sameSheetAgain).toFixed(2)}`
  );
  check(
    "seller B's sheet does NOT match seller A's template",
    signatureSimilarity(savedSignature, headerSignature(bA.parsed.headers)) < TEMPLATE_MATCH_SCORE,
    `similarity ${signatureSimilarity(savedSignature, headerSignature(bA.parsed.headers)).toFixed(2)}`
  );

  // ── 5. Import history ────────────────────────────────────────────────────
  section("5. import history");

  const batches = await dbA.importBatch.findMany({ orderBy: { createdAt: "asc" } });
  check("both imports are logged", batches.length === 2, batches.map((b) => b.fileName).join(", "));
  check(
    "first batch: 5 new, 0 updated, 0 skipped",
    batches[0]?.importedCount === 5 && batches[0]?.updatedCount === 0 && batches[0]?.skippedCount === 0
  );
  check(
    "second batch: 2 new, 2 updated, 3 skipped",
    batches[1]?.importedCount === 2 && batches[1]?.updatedCount === 2 && batches[1]?.skippedCount === 3,
    `new=${batches[1]?.importedCount} updated=${batches[1]?.updatedCount} skipped=${batches[1]?.skippedCount}`
  );
  check("store B has no import history", (await dbB.importBatch.findMany()).length === 0);

  const traced = await dbA.card.findMany({ where: { importBatchId: batches[1]?.id } });
  check(
    "cards can be traced back to the import that created them",
    traced.length === 2 && traced.every((card) => card.importBatchId === batches[1]?.id),
    traced.map((c) => c.name).join(", ")
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
