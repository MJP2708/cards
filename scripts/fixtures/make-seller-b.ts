/**
 * Regenerates seller-b-different.xlsx.
 *
 *   npx tsx scripts/fixtures/make-seller-b.ts
 *
 * Seller B's sheet names every column differently from the app's own vocabulary,
 * orders them differently, and is .xlsx rather than .csv. Its rows are chosen to
 * hit each deduplication outcome against the inventory seller A's sheet leaves
 * behind, so `check-import-flow.ts` can assert all of them from one file.
 */
import ExcelJS from "exceljs";
import path from "node:path";

const headers = [
  "Stock #", "Sport", "On Hand", "Player Name", "Condition", "Set Name", "Yr",
  "Card #", "List Price", "Purchase Price", "Club", "Availability", "Remarks",
];

const rows: (string | number)[][] = [
  // Identical to what is already in stock — nothing to do.
  ["SKU-001", "Basketball", 1, "Luka Doncic", "PSA 10", "2023 Panini Prizm", 2023, "#12", 9900, 4500, "Mavericks", "In Stock", ""],
  // Same card, restocked and re-priced.
  ["SKU-002", "Basketball", 5, "Victor Wembanyama", "PSA 9", "2023 Panini Prizm", 2023, "#136", 26500, 12000, "Spurs", "In Stock", "restocked"],
  // Everything matches except the grade — a typo, or a second, graded copy?
  ["SKU-003", "Basketball", 1, "Jayson Tatum", "PSA 9", "2022 Panini Select", 2022, "#45", 4200, 1800, "Celtics", "In Stock", ""],
  // Same card, now reserved for a buyer.
  ["SKU-004", "Soccer", 1, "Erling Haaland", "BGS 9.5", "2023 Topps Chrome UCL", 2023, "#7", 7400, 3200, "Man City", "Reserved", "held for Nok"],
  // A category this store has no equivalent for.
  ["SKU-005", "Baseball", 2, "Shohei Ohtani", "PSA 10", "2023 Topps Chrome", 2023, "#27", 15000, 6000, "Dodgers", "In Stock", ""],
  // Genuinely new.
  ["SKU-006", "Basketball", 4, "Anthony Edwards", "", "2023 Panini Donruss", 2023, "#88", 2400, 900, "Timberwolves", "In Stock", ""],
  // A byte-for-byte repeat of the row above, inside the same file.
  ["SKU-007", "Basketball", 4, "Anthony Edwards", "", "2023 Panini Donruss", 2023, "#88", 2400, 900, "Timberwolves", "In Stock", ""],
  // No price and no cost — must default and be flagged, not rejected.
  ["SKU-008", "Basketball", "", "Paolo Banchero", "", "2022 Panini Prizm", 2022, "#54", "", "", "Magic", "", "price TBC"],
];

const workbook = new ExcelJS.Workbook();
// Deliberately not called "Inventory": the parser's preferred-sheet lookup must
// fall back to the first sheet for a workbook that never heard of that convention.
const sheet = workbook.addWorksheet("Stock List");
sheet.addRow(headers);
for (const row of rows) sheet.addRow(row);

const target = path.join(import.meta.dirname, "seller-b-different.xlsx");
workbook.xlsx.writeFile(target).then(() => {
  console.log(`wrote ${target} — ${rows.length} rows, ${headers.length} columns`);
});
