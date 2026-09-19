/**
 * Recovers a vendor's own card numbering and writes a sheet the importer's
 * "Re-align numbers only" mode can consume.
 *
 *   npx tsx --env-file=.env scripts/match-vendor-numbering.ts \
 *     --file ~/Downloads/vendor.xlsx --store <storeId> [--sheet Sheet1] [--out realign.xlsx]
 *
 * Read-only against the database. It writes one spreadsheet and nothing else.
 *
 * ## Why this exists
 * The cards are already in the app, correctly split into name and series. What
 * was lost is which row of the vendor's list each one came from — and that row
 * number is what is physically written on the sleeve. The vendor's list is free
 * text ("Victor imaculate MW 98"), so the link has to be recovered by matching
 * rather than looked up.
 *
 * ## How confident it is
 * Two independent signals: the asking price, which is exact but far from unique
 * across a shop's inventory, and the similarity of the vendor's description to
 * the card's name and series. Either alone is too weak — 16 of 222 rows had a
 * unique price when measured — so a match needs both to agree. Anything below
 * the confidence bar is left out of the sheet and listed for a human, because a
 * wrong number here recreates exactly the problem this is meant to fix.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { similarity } from "../src/lib/import/fuzzy";

function arg(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing --${name}`);
}

/**
 * A match needs the combined score to clear this. Set high deliberately: an
 * unmatched row costs a minute of someone's attention, a wrongly matched one
 * puts the wrong number on a sleeve and is not noticed until a sale.
 */
const CONFIDENT = 0.72;

/** Price agreeing is worth this much of the combined score; the text carries the rest. */
const PRICE_WEIGHT = 0.45;

type VendorRow = { number: number; description: string; price: number | null };

async function readVendorSheet(file: string, sheetName: string): Promise<VendorRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await readFile(file)).buffer as ArrayBuffer);
  const sheet = workbook.getWorksheet(sheetName) ?? workbook.worksheets[0];
  if (!sheet) throw new Error(`No sheet "${sheetName}" in ${file}`);

  const rows: VendorRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cell = (i: number) => {
      let v: unknown = row.getCell(i).value;
      if (v && typeof v === "object" && "result" in v) v = (v as { result?: unknown }).result;
      if (v && typeof v === "object" && "text" in v) v = (v as { text?: unknown }).text;
      return String(v ?? "").trim();
    };
    const number = Number(cell(1));
    const description = cell(2);
    const price = Number(cell(3).replace(/[^0-9.]/g, ""));
    // The header row and the trailing stub both fail one of these.
    if (Number.isInteger(number) && number >= 1 && description) {
      rows.push({ number, description, price: Number.isFinite(price) && price > 0 ? price : null });
    }
  });
  return rows;
}

async function main() {
  const file = arg("file").replace(/^~/, process.env.HOME ?? "~");
  const storeId = arg("store");
  const sheetName = arg("sheet", "Sheet1");
  const out = arg("out", path.join(process.env.HOME ?? ".", "Downloads", "realign.xlsx"));

  const prisma = new PrismaClient({
    // DIRECT_URL: the pooled endpoint is not always reachable outside the app.
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
  });

  const vendorRows = await readVendorSheet(file, sheetName);
  const cards = await prisma.card.findMany({
    where: { storeId },
    select: {
      id: true, lookupNumber: true, category: true, name: true, series: true,
      year: true, cardNumber: true, grade: true, askingPrice: true,
    },
  });

  console.log(`vendor sheet "${sheetName}": ${vendorRows.length} numbered rows`);
  console.log(`store ${storeId}: ${cards.length} cards\n`);

  // Score every pair, then assign greedily best-first so each card and each row
  // is used at most once. Per-row best-match would hand one card to two rows.
  type Pair = { row: VendorRow; card: (typeof cards)[number]; score: number; priceAgrees: boolean };
  const pairs: Pair[] = [];
  for (const row of vendorRows) {
    for (const card of cards) {
      const text = similarity(row.description, `${card.name} ${card.series}`);
      const nameOnly = similarity(row.description, card.name);
      const textScore = Math.max(text, nameOnly);
      const priceAgrees = row.price !== null && Math.round(card.askingPrice) === Math.round(row.price);
      const score = (priceAgrees ? PRICE_WEIGHT : 0) + textScore * (1 - PRICE_WEIGHT);
      if (score >= 0.35) pairs.push({ row, card, score, priceAgrees });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  const takenRows = new Set<number>();
  const takenCards = new Set<string>();
  const matched: Pair[] = [];
  for (const pair of pairs) {
    if (takenRows.has(pair.row.number) || takenCards.has(pair.card.id)) continue;
    if (pair.score < CONFIDENT) continue;
    takenRows.add(pair.row.number);
    takenCards.add(pair.card.id);
    matched.push(pair);
  }

  // Second pass, over what is left.
  //
  // Price was a weak signal across the whole shop — many cards share a price —
  // but most of those cards have now been claimed. Among the remainder an exact
  // price often identifies exactly one card, and the rows that reach here are
  // precisely the ones whose text could not match: the vendor wrote a nickname
  // or an abbreviation ("Antman", "KG", "J.will") that no string metric will
  // ever align with the full name. Uniqueness within the leftovers is the
  // evidence; where the price still fits more than one card, it is left alone.
  const leftoverRows = vendorRows.filter((r) => !takenRows.has(r.number));
  const leftoverCards = cards.filter((c) => !takenCards.has(c.id));
  const priceOnly: Pair[] = [];

  for (const row of leftoverRows) {
    if (row.price === null) continue;
    const fits = leftoverCards.filter(
      (c) => !takenCards.has(c.id) && Math.round(c.askingPrice) === Math.round(row.price!)
    );
    if (fits.length !== 1) continue;
    takenRows.add(row.number);
    takenCards.add(fits[0].id);
    const pair: Pair = { row, card: fits[0], score: PRICE_WEIGHT, priceAgrees: true };
    matched.push(pair);
    priceOnly.push(pair);
  }

  // Third pass: interpolate between anchors.
  //
  // The rows still unmatched are ones whose price is shared and whose text is a
  // nickname. But the app's existing numbering broadly preserved the vendor's
  // order, so a row sitting between two already-matched rows must correspond to
  // a card sitting between their two cards. Where exactly one unclaimed card
  // falls inside that window, the row is determined rather than guessed.
  //
  // The assumption is checked, not assumed: if the anchors are not themselves in
  // increasing order the ordering does not hold and this pass is skipped.
  matched.sort((a, b) => a.row.number - b.row.number);
  const anchors = matched.map((m) => ({ rowNumber: m.row.number, cardNumber: m.card.lookupNumber }));
  const inversions = anchors.filter((a, i) => i > 0 && a.cardNumber <= anchors[i - 1].cardNumber).length;
  const orderingHolds = anchors.length > 10 && inversions / anchors.length < 0.05;
  const interpolated: Pair[] = [];

  console.log(
    `anchor ordering: ${anchors.length - inversions}/${anchors.length} in sequence` +
      (orderingHolds ? " — using it to place the remainder" : " — too scrambled to interpolate")
  );

  if (orderingHolds) {
    for (const row of vendorRows.filter((r) => !takenRows.has(r.number))) {
      const before = anchors.filter((a) => a.rowNumber < row.number).at(-1);
      const after = anchors.find((a) => a.rowNumber > row.number);
      const low = before?.cardNumber ?? 0;
      const high = after?.cardNumber ?? Number.MAX_SAFE_INTEGER;

      const fits = cards.filter(
        (c) => !takenCards.has(c.id) && c.lookupNumber > low && c.lookupNumber < high
      );
      if (fits.length !== 1) continue;

      takenRows.add(row.number);
      takenCards.add(fits[0].id);
      const pair: Pair = { row, card: fits[0], score: 0, priceAgrees: false };
      matched.push(pair);
      interpolated.push(pair);
    }
  }

  matched.sort((a, b) => a.row.number - b.row.number);
  const unmatchedRows = vendorRows.filter((r) => !takenRows.has(r.number));
  const unmatchedCards = cards.filter((c) => !takenCards.has(c.id));

  console.log(`confident matches: ${matched.length}`);
  console.log(`  price and text agreed:        ${matched.length - priceOnly.length - interpolated.length}`);
  console.log(`  unique price only (verify):   ${priceOnly.length}`);
  console.log(`  placed by position (verify):  ${interpolated.length}`);
  console.log(`unmatched vendor rows: ${unmatchedRows.length}`);
  console.log(`unmatched cards:       ${unmatchedCards.length}\n`);

  if (priceOnly.length) {
    console.log("\nmatched on a unique price alone — worth a glance, the vendor used a nickname:");
    for (const { row, card } of priceOnly.slice(0, 30)) {
      console.log(`  #${String(row.number).padEnd(4)} "${row.description}" ฿${row.price}  ->  ${card.name} | ${card.series}`);
    }
    if (priceOnly.length > 30) console.log(`  … and ${priceOnly.length - 30} more`);
    console.log();
  }

  if (interpolated.length) {
    console.log("placed by position between matched neighbours — check these:");
    for (const { row, card } of interpolated.slice(0, 40)) {
      console.log(`  #${String(row.number).padEnd(4)} "${row.description}" ฿${row.price ?? "?"}  ->  was app #${card.lookupNumber}  ${card.name} | ${card.series}`);
    }
    if (interpolated.length > 40) console.log(`  … and ${interpolated.length - 40} more`);
    console.log();
  }

  if (unmatchedRows.length) {
    console.log("vendor rows needing a human (not written to the sheet):");
    for (const row of unmatchedRows.slice(0, 25)) {
      console.log(`  #${String(row.number).padEnd(4)} "${row.description}" ${row.price ? `฿${row.price}` : ""}`);
    }
    if (unmatchedRows.length > 25) console.log(`  … and ${unmatchedRows.length - 25} more`);
    console.log();
  }
  if (unmatchedCards.length) {
    console.log("cards no vendor row claimed (they keep their current numbers):");
    for (const card of unmatchedCards.slice(0, 25)) {
      console.log(`  app #${String(card.lookupNumber).padEnd(4)} ${card.name} | ${card.series} | ฿${card.askingPrice}`);
    }
    if (unmatchedCards.length > 25) console.log(`  … and ${unmatchedCards.length - 25} more`);
    console.log();
  }

  // The sheet carries the identity columns the re-align matcher fingerprints on,
  // taken from the card itself rather than the vendor's text, so the match it
  // makes later is exact instead of fuzzy a second time.
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inventory");
  sheet.addRow(["Lookup #", "Category", "Name", "Series/Set", "Year", "Card Number", "Grade"]);
  for (const { row, card } of matched) {
    sheet.addRow([
      row.number, card.category, card.name, card.series,
      card.year ?? "", card.cardNumber ?? "", card.grade ?? "",
    ]);
  }
  await workbook.xlsx.writeFile(out);
  console.log(`wrote ${out} — ${matched.length} rows`);
  console.log('Import it with "Re-align numbers only" ticked, and check the preview before applying.');

  // A second, complete file: every card in the store, carrying the corrected
  // numbering and every column the importer reads.
  //
  // This is the restore point. The structured name/series data in the database
  // is the only copy left — the files it was imported from are gone — so before
  // anyone considers emptying the store, that data needs to exist somewhere
  // outside it. Cards the vendor's list never mentioned keep a number past the
  // end rather than being dropped.
  if (process.argv.includes("--full")) {
    const fullPath = out.replace(/\.xlsx$/, "-full.xlsx");
    const numberByCard = new Map(matched.map(({ row, card }) => [card.id, row.number]));
    let spare = Math.max(0, ...matched.map((m) => m.row.number));

    const fullBook = new ExcelJS.Workbook();
    const fullSheet = fullBook.addWorksheet("Inventory");
    fullSheet.addRow([
      "Lookup #", "Category", "Name", "Series/Set", "Year", "Card Number",
      "Card Type", "Rarity", "Grade", "Team", "Cost Basis", "Asking Price",
      "Quantity", "Status",
    ]);

    const full = await prisma.card.findMany({ where: { storeId } });
    const ordered = [...full].sort(
      (a, b) => (numberByCard.get(a.id) ?? Infinity) - (numberByCard.get(b.id) ?? Infinity)
    );
    for (const card of ordered) {
      const attributes = (card.attributes as Record<string, unknown> | null) ?? {};
      fullSheet.addRow([
        numberByCard.get(card.id) ?? ++spare,
        card.category, card.name, card.series, card.year ?? "", card.cardNumber ?? "",
        card.cardType ?? "", card.rarity ?? "", card.grade ?? "",
        typeof attributes.team === "string" ? attributes.team : "",
        card.costBasis, card.askingPrice, card.quantity, card.status,
      ]);
    }
    await fullBook.xlsx.writeFile(fullPath);
    console.log(`wrote ${fullPath} — all ${full.length} cards, corrected numbering, full columns`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
