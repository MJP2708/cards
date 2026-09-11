import ExcelJS from "exceljs";
import Papa from "papaparse";

/**
 * Header matching is deliberately loose: the worksheet says "Card Number" and
 * "Series/Set" while the existing CSV template emits camelCase `cardNumber`.
 * Normalising both to bare alphanumerics lets one mapping serve both.
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    // Drop a trailing unit/currency note first — "Cost Basis (THB)" is still costBasis,
    // and without this it normalises to "costbasisthb" and silently goes unmapped.
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Worksheet column -> Card field. Several spellings map to the same field. */
const COLUMN_ALIASES: Record<string, string> = {
  category: "category",
  name: "name",
  cardname: "name",
  player: "name",
  playername: "name",
  teamgame: "team",
  team: "team",
  game: "team",
  seriesset: "series",
  series: "series",
  set: "series",
  year: "year",
  cardnumber: "cardNumber",
  number: "cardNumber",
  no: "cardNumber",
  cardtype: "cardType",
  type: "cardType",
  rarity: "rarity",
  grade: "grade",
  costbasis: "costBasis",
  cost: "costBasis",
  askingprice: "askingPrice",
  asking: "askingPrice",
  price: "askingPrice",
  quantity: "quantity",
  qty: "quantity",
  status: "status",
  qrcode: "qrCode",
  buyernote: "buyerNote",
  notes: "buyerNote",
};

export type RawRow = { rowNumber: number; values: Record<string, string> };

export type ParsedWorksheet = {
  rows: RawRow[];
  /** Headers present in the file that we had no mapping for — surfaced, not silently dropped. */
  unmappedHeaders: string[];
  sheetName: string | null;
};

function mapHeaders(headers: string[]) {
  const mapped: (string | null)[] = [];
  const unmapped: string[] = [];
  for (const header of headers) {
    const key = COLUMN_ALIASES[normalizeHeader(header)] ?? null;
    mapped.push(key);
    if (!key && header.trim()) unmapped.push(header.trim());
  }
  return { mapped, unmapped };
}

function buildRows(headers: string[], dataRows: string[][], firstDataRowNumber: number): ParsedWorksheet {
  const { mapped, unmapped } = mapHeaders(headers);
  const rows: RawRow[] = [];

  dataRows.forEach((cells, index) => {
    const values: Record<string, string> = {};
    mapped.forEach((key, column) => {
      if (!key) return;
      const cell = (cells[column] ?? "").toString().trim();
      if (cell) values[key] = cell;
    });
    // Skip rows that are entirely blank rather than reporting them as failures.
    if (Object.keys(values).length > 0) {
      rows.push({ rowNumber: firstDataRowNumber + index, values });
    }
  });

  return { rows, unmappedHeaders: unmapped, sheetName: null };
}

async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedWorksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // The demo workbook carries an "Inventory" sheet plus a "Legend & Notes" sheet;
  // prefer the named one so the legend is never parsed as data.
  const sheet =
    workbook.worksheets.find((w) => normalizeHeader(w.name).includes("inventory")) ?? workbook.worksheets[0];
  if (!sheet) throw new Error("The workbook has no sheets.");

  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      let text = "";
      const value = cell.value;
      if (value !== null && value !== undefined) {
        if (value instanceof Date) text = value.toISOString().slice(0, 10);
        else if (typeof value === "object" && "result" in value) text = String(value.result ?? "");
        else if (typeof value === "object" && "text" in value) text = String(value.text ?? "");
        else text = String(value);
      }
      cells[colNumber - 1] = text.trim();
    });
    table.push(cells);
  });

  if (table.length === 0) throw new Error("The sheet is empty.");
  const [headers, ...dataRows] = table;
  const parsed = buildRows(headers, dataRows, 2);
  parsed.sheetName = sheet.name;
  return parsed;
}

function parseCsv(text: string): ParsedWorksheet {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const table = result.data;
  if (table.length === 0) throw new Error("The file is empty.");
  const [headers, ...dataRows] = table;
  return buildRows(headers, dataRows, 2);
}

export async function parseWorksheet(file: {
  name: string;
  buffer: ArrayBuffer;
}): Promise<ParsedWorksheet> {
  const isExcel = /\.xlsx?$/i.test(file.name);
  if (isExcel) return parseXlsx(file.buffer);
  return parseCsv(new TextDecoder().decode(file.buffer));
}
