import ExcelJS from "exceljs";
import Papa from "papaparse";
import { normalizeHeader } from "./fuzzy";

/**
 * Reads a worksheet as-is.
 *
 * This deliberately does not interpret columns. Every seller brings their own
 * sheet, so which column means what is a decision the user confirms on the
 * mapping screen (`src/lib/import/mapping.ts`) — parsing only reports what is
 * actually in the file. Keeping raw cells also means the mapping can be changed
 * and re-previewed without re-uploading.
 */

export type RawRow = {
  /** 1-based row number in the source file, so errors point at the real row. */
  rowNumber: number;
  /** Cell text in column order, aligned with `headers`. */
  cells: string[];
};

export type ParsedWorksheet = {
  headers: string[];
  rows: RawRow[];
  sheetName: string | null;
};

/** Blank and duplicate headers still need a stable, distinct name to map against. */
function labelHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((header, index) => {
    const trimmed = (header ?? "").trim();
    const base = trimmed || `Column ${index + 1}`;
    const key = normalizeHeader(base) || `col${index}`;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    // "Price" twice becomes "Price" and "Price (2)" — the field map is keyed by
    // header text, so two identical headers would otherwise be indistinguishable.
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function buildRows(headers: string[], dataRows: string[][], firstDataRowNumber: number): ParsedWorksheet {
  const labelled = labelHeaders(headers);
  const rows: RawRow[] = [];

  dataRows.forEach((cells, index) => {
    const normalized = labelled.map((_, column) => (cells[column] ?? "").toString().trim());
    // Skip rows that are entirely blank rather than reporting them as failures.
    if (normalized.some((cell) => cell !== "")) {
      rows.push({ rowNumber: firstDataRowNumber + index, cells: normalized });
    }
  });

  return { headers: labelled, rows, sheetName: null };
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
