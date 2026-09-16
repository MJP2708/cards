/**
 * Builds `demo_card_inventory_corrupted.xlsx` from the clean demo workbook by
 * planting one of each kind of error the verification pass is supposed to catch.
 *
 *   npx tsx scripts/fixtures/make-corrupted-demo.ts
 *
 * Derived from the real file rather than hand-written, so the clean and corrupted
 * runs differ only by the planted faults — which is what makes "it caught the bad
 * row" mean something rather than "it flagged a different sheet".
 */
import ExcelJS from "exceljs";
import path from "node:path";

const DIR = import.meta.dirname;

/** Each edit is keyed by player so it survives any row reordering upstream. */
const EDITS: Record<string, { column: string; value: string | number; why: string }[]> = {
  "Lionel Messi": [
    { column: "Team/Game", value: "Lakers", why: "football card carrying an NBA team" },
  ],
  "Victor Wembanyama": [
    { column: "Asking Price (THB)", value: 250, why: "asking price ~48x under cost — dropped digit" },
  ],
  "Anthony Edwards": [
    { column: "Year", value: 2031, why: "year in the future" },
  ],
  "Stephen Curry": [
    { column: "Grade", value: "PSA 47", why: "grade score outside the 1-10 range" },
  ],
  "Kylian Mbappe": [
    { column: "Series/Set", value: "2019 Panini Prizm", why: "set name's year contradicts the year column" },
  ],
  "Erling Haaland": [
    { column: "Asking Price (THB)", value: 1200, why: "asking below cost — plausible markdown, low severity" },
  ],
};

/** LeBron's row is duplicated verbatim to trip the fingerprint duplicate check. */
const DUPLICATE_OF = "LeBron James";

async function main() {
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(path.join(DIR, "demo_card_inventory_nba_football.xlsx"));

const sheet = workbook.worksheets.find((w) => w.name.toLowerCase().includes("inventory"));
if (!sheet) throw new Error("No Inventory sheet in the demo workbook.");

const header: string[] = [];
sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, i) => {
  header[i] = String(cell.value ?? "").trim();
});
const columnIndex = (name: string) => header.findIndex((h) => h === name);

const nameCol = columnIndex("Name");
let duplicateSource: unknown[] = [];

sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
  if (rowNumber === 1) return;
  const player = String(row.getCell(nameCol).value ?? "").trim();

  for (const edit of EDITS[player] ?? []) {
    const col = columnIndex(edit.column);
    if (col === -1) throw new Error(`Column "${edit.column}" not found in the demo workbook.`);
    row.getCell(col).value = edit.value;
    console.log(`  row ${rowNumber}  ${player}: ${edit.column} -> ${edit.value}   (${edit.why})`);
  }

  if (player === DUPLICATE_OF) {
    duplicateSource = (row.values as unknown[]).slice();
  }
});

if (duplicateSource.length > 0) {
  sheet.addRow(duplicateSource.slice(1));
  console.log(`  appended  ${DUPLICATE_OF}: exact duplicate row   (fingerprint duplicate)`);
}

const target = path.join(DIR, "demo_card_inventory_corrupted.xlsx");
await workbook.xlsx.writeFile(target);
console.log(`\nwrote ${target}`);
}

main();
