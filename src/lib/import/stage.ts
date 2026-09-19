import type { StoreDb } from "@/lib/db/scoped";
import { cardInputSchema, type CardInput } from "@/lib/validation/card";
import { validateAttributes } from "@/lib/validation/attributes";
import type { CategoryDTO } from "@/lib/categories";
import type { RawRow } from "./worksheet";
import { buildFieldCatalog } from "./fields";
import { valueFor, type FieldMap } from "./mapping";
import { describeDifference, fingerprint, looseFingerprint } from "./fingerprint";

/**
 * What the importer found when it looked this row up in the store's inventory.
 *
 *  - `new`             no fingerprint match at all
 *  - `exact_unchanged` same card, and nothing about the listing differs
 *  - `exact_changed`   same card, but quantity/price/status differ
 *  - `possible`        identity matches except for one field (typically grade),
 *                      which is either a typo or a genuinely different slab
 *  - `failed`          cannot be imported at all (no name, unresolved category…)
 */
export type MatchStatus = "new" | "exact_unchanged" | "exact_changed" | "possible" | "failed";

/**
 * `undecided` exists so a "possible match" is not silently resolved. It is not a
 * committable action: the staging screen must show it, and the commit summary
 * counts it as skipped so the user sees the consequence before confirming.
 */
export type RowAction = "new" | "update" | "merge" | "skip" | "undecided";

export type ExistingMatch = {
  id: string;
  name: string;
  series: string;
  grade: string | null;
  quantity: number;
  askingPrice: number;
  costBasis: number;
  status: string;
};

export type FieldChange = { field: string; from: string; to: string };

export type StagedRow = {
  rowNumber: number;
  /**
   * The quick-reference number this row will end up with. A number the sheet
   * supplied, or null meaning "allocate one at commit". Kept beside the card
   * rather than inside it because it is assigned by the store, not described by
   * the spreadsheet row.
   */
  lookupNumber: number | null;
  match: MatchStatus;
  /** Warnings worth a human's eye. Non-empty does not block import. */
  issues: string[];
  /** Populated for exact_changed: exactly what committing an update would alter. */
  changes: FieldChange[];
  card: CardInput | null;
  existing: ExistingMatch | null;
  suggestedAction: RowAction;
};

export type StagedImport = {
  rows: StagedRow[];
  unmappedHeaders: string[];
  summary: {
    total: number;
    new: number;
    exactUnchanged: number;
    exactChanged: number;
    possible: number;
    failed: number;
  };
};

const STATUS_ALIASES: Record<string, CardInput["status"]> = {
  instock: "In Stock",
  available: "In Stock",
  unsold: "In Stock",
  active: "In Stock",
  yes: "In Stock",
  sold: "Sold",
  reserved: "Reserved",
  onhold: "On Hold",
  hold: "On Hold",
  pending: "On Hold",
};

function normalizeStatus(value: string): { status: CardInput["status"]; issue?: string } {
  if (!value) return { status: "In Stock" };
  const key = value.toLowerCase().replace(/[^a-z]/g, "");
  const mapped = STATUS_ALIASES[key];
  if (mapped) return { status: mapped };
  return { status: "In Stock", issue: `Unrecognised status "${value}" — defaulted to In Stock.` };
}

/** Money columns often arrive as "฿1,200", "$45.00" or "1,200.00". */
function parseNumber(value: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Sheets write years as "2023", "2023-24" or "2023/24"; the first number is the one. */
function parseYear(value: string): number | null {
  const match = value.match(/\d{4}/);
  if (!match) return null;
  const year = Number(match[0]);
  return year >= 1800 && year <= 2200 ? year : null;
}

function money(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export type StageInput = {
  headers: string[];
  rows: RawRow[];
  fieldMap: FieldMap;
  /** Lowercased raw category value -> this store's category key. */
  categoryMap: Record<string, string>;
};

/**
 * Turns confirmed-mapping rows into a preview of exactly what commit would do.
 *
 * Writes nothing. Everything this returns is a proposal the user can override on
 * the staging screen, which is the only place the decisions are made.
 */
export async function stageRows(
  db: StoreDb,
  categories: CategoryDTO[],
  input: StageInput
): Promise<StagedImport> {
  const { headers, rows, fieldMap, categoryMap } = input;

  const categoryByKey = new Map(categories.map((c) => [c.key.toLowerCase(), c]));
  const fields = buildFieldCatalog(categories);
  const attributeFields = fields.filter((f) => f.kind === "attribute");

  const mappedHeaders = new Set(Object.values(fieldMap).filter((h): h is string => Boolean(h)));
  const unmappedHeaders = headers.filter((h) => !mappedHeaders.has(h));

  // One query, then matched in memory: a lookup per row would be hundreds of
  // round trips on a large sheet. `db` is store-scoped, so this can only ever
  // see this store's cards — the per-tenant guarantee comes from the client,
  // not from remembering a filter here.
  const existingCards = await db.card.findMany({
    select: {
      id: true,
      category: true,
      name: true,
      series: true,
      year: true,
      cardNumber: true,
      grade: true,
      quantity: true,
      askingPrice: true,
      costBasis: true,
      status: true,
      lookupNumber: true,
    },
  });

  // Supplied lookup numbers are checked against what this store already uses, and
  // against each other. Silently overwriting either would make one number mean two
  // cards — the failure this whole numbering scheme exists to prevent.
  const usedNumbers = new Map(existingCards.map((card) => [card.lookupNumber, card.name]));
  const numbersInThisFile = new Map<number, number>();

  const exactIndex = new Map<string, (typeof existingCards)[number]>();
  const looseIndex = new Map<string, (typeof existingCards)[number][]>();
  for (const card of existingCards) {
    exactIndex.set(fingerprint(card), card);
    const loose = looseFingerprint(card);
    const bucket = looseIndex.get(loose);
    if (bucket) bucket.push(card);
    else looseIndex.set(loose, [card]);
  }

  /** Fingerprints created earlier in *this same file*, so a sheet can't duplicate itself. */
  const seenInThisFile = new Map<string, number>();

  const staged: StagedRow[] = rows.map((row) => {
    const issues: string[] = [];
    const read = (key: string) => valueFor(headers, row.cells, fieldMap, key);

    const rawCategory = read("category");
    const categoryKey = categoryMap[rawCategory.toLowerCase()] ?? null;
    const category = categoryKey ? categoryByKey.get(categoryKey.toLowerCase()) : undefined;

    const failed = (reason: string): StagedRow => ({
      rowNumber: row.rowNumber,
      lookupNumber: null,
      match: "failed",
      issues: [...issues, reason],
      changes: [],
      card: null,
      existing: null,
      suggestedAction: "skip",
    });

    if (!rawCategory) return failed("Missing Category — this row has no value in the mapped category column.");
    if (!category) {
      return failed(
        `Category "${rawCategory}" is not mapped to one of this store's categories. Resolve it on the category step, or add the category in Settings first.`
      );
    }

    const name = read("name");
    if (!name) return failed("Missing Name — the mapped name column is blank on this row.");

    let series = read("series");
    if (!series) {
      series = "Unknown Set";
      issues.push(
        fieldMap.series
          ? "Series/Set is blank on this row — set to \"Unknown Set\"."
          : "No Series/Set column in this sheet — set to \"Unknown Set\"."
      );
    }

    const rawYear = read("year");
    const year = rawYear ? parseYear(rawYear) : null;
    if (rawYear && year === null) issues.push(`Could not read Year "${rawYear}" — left blank.`);

    const rawCost = read("costBasis");
    const costBasis = parseNumber(rawCost);
    if (rawCost && costBasis === null) issues.push(`Could not read Cost Basis "${rawCost}" — set to 0.`);
    else if (!rawCost) {
      issues.push(fieldMap.costBasis ? "Cost Basis is blank — set to 0." : "No Cost Basis column in this sheet — set to 0.");
    }

    const rawPrice = read("askingPrice");
    const askingPrice = parseNumber(rawPrice);
    if (rawPrice && askingPrice === null) issues.push(`Could not read Asking Price "${rawPrice}" — set to 0.`);
    else if (!rawPrice) {
      issues.push(
        fieldMap.askingPrice ? "Asking Price is blank — set to 0." : "No Asking Price column in this sheet — set to 0."
      );
    }

    const rawQuantity = read("quantity");
    const quantity = parseNumber(rawQuantity);
    if (rawQuantity && quantity === null) issues.push(`Could not read Quantity "${rawQuantity}" — set to 1.`);

    const { status, issue: statusIssue } = normalizeStatus(read("status"));
    if (statusIssue) issues.push(statusIssue);

    // A sheet may carry the vendor's own numbering from a paper scheme set up
    // beforehand. Those are preserved; anything else is allocated at commit.
    let lookupNumber: number | null = null;
    const rawLookup = read("lookupNumber");
    if (rawLookup) {
      const parsedLookup = parseNumber(rawLookup);
      if (parsedLookup === null || !Number.isInteger(parsedLookup) || parsedLookup < 1) {
        issues.push(`Could not read Lookup # "${rawLookup}" — a number will be assigned instead.`);
      } else {
        lookupNumber = parsedLookup;
        const clashingCard = usedNumbers.get(parsedLookup);
        const clashingRow = numbersInThisFile.get(parsedLookup);
        if (clashingCard !== undefined) {
          issues.push(
            `Lookup #${parsedLookup} is already used by "${clashingCard}" in this store. Importing this row as-is would make one number mean two cards.`
          );
        } else if (clashingRow !== undefined) {
          issues.push(`Lookup #${parsedLookup} is also used by row ${clashingRow} of this same file.`);
        } else {
          numbersInThisFile.set(parsedLookup, row.rowNumber);
        }
      }
    }

    // Attributes come from the category's own field schema, so a custom category
    // added later picks up its columns without a code change.
    const attributes: Record<string, string> = {};
    for (const field of attributeFields) {
      const value = read(field.key);
      if (value) attributes[field.key] = value;
    }

    const candidate = {
      category: category.key,
      name,
      series,
      year,
      cardNumber: read("cardNumber") || null,
      cardType: read("cardType") || null,
      rarity: read("rarity") || null,
      grade: read("grade") || null,
      costBasis: costBasis ?? 0,
      askingPrice: askingPrice ?? 0,
      quantity: quantity !== null && quantity >= 1 ? Math.round(quantity) : 1,
      status,
      qrCode: read("qrCode") || null,
      buyerNote: read("buyerNote") || null,
      attributes,
    };

    const parsed = cardInputSchema.safeParse(candidate);
    if (!parsed.success) {
      return failed(
        parsed.error.issues.map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`).join("; ")
      );
    }
    const card = parsed.data;

    // Missing required attributes are reviewable, not fatal — the row still imports.
    issues.push(...validateAttributes(category.fieldSchema, attributes));

    // --- Identity resolution -------------------------------------------------
    const exactPrint = fingerprint(card);

    const duplicateOfRow = seenInThisFile.get(exactPrint);
    if (duplicateOfRow !== undefined) {
      return {
        rowNumber: row.rowNumber,
        lookupNumber,
        match: "possible",
        issues: [
          ...issues,
          `Row ${duplicateOfRow} of this same file describes the same card. Two copies, or a repeated row?`,
        ],
        changes: [],
        card,
        existing: null,
        suggestedAction: "undecided",
      };
    }
    seenInThisFile.set(exactPrint, row.rowNumber);

    const exact = exactIndex.get(exactPrint);
    if (exact) {
      const existing: ExistingMatch = {
        id: exact.id,
        name: exact.name,
        series: exact.series,
        grade: exact.grade,
        quantity: exact.quantity,
        askingPrice: exact.askingPrice,
        costBasis: exact.costBasis,
        status: exact.status,
      };

      const changes: FieldChange[] = [];
      if (exact.quantity !== card.quantity) {
        changes.push({ field: "quantity", from: String(exact.quantity), to: String(card.quantity) });
      }
      // A 0 here means "the sheet didn't say", not "it is free" — overwriting a
      // real price with it would be a silent data loss, so it is not a change.
      if (card.askingPrice > 0 && exact.askingPrice !== card.askingPrice) {
        changes.push({ field: "askingPrice", from: money(exact.askingPrice), to: money(card.askingPrice) });
      }
      if (card.costBasis > 0 && exact.costBasis !== card.costBasis) {
        changes.push({ field: "costBasis", from: money(exact.costBasis), to: money(card.costBasis) });
      }
      if (exact.status !== card.status) {
        changes.push({ field: "status", from: exact.status, to: card.status });
      }

      return {
        rowNumber: row.rowNumber,
        lookupNumber,
        match: changes.length === 0 ? "exact_unchanged" : "exact_changed",
        issues,
        changes,
        card,
        existing,
        suggestedAction: changes.length === 0 ? "skip" : "update",
      };
    }

    const loose = looseIndex.get(looseFingerprint(card)) ?? [];
    const near = loose[0];
    if (near) {
      const difference = describeDifference(card, near);
      return {
        rowNumber: row.rowNumber,
        lookupNumber,
        match: "possible",
        issues: [
          ...issues,
          `Looks like "${near.name} — ${near.series}" already in inventory, but ${difference ?? "one field differs"}. Could be a typo or a genuinely different card.`,
        ],
        changes: [],
        card,
        existing: {
          id: near.id,
          name: near.name,
          series: near.series,
          grade: near.grade,
          quantity: near.quantity,
          askingPrice: near.askingPrice,
          costBasis: near.costBasis,
          status: near.status,
        },
        suggestedAction: "undecided",
      };
    }

    return {
      rowNumber: row.rowNumber,
      lookupNumber,
      match: "new",
      issues,
      changes: [],
      card,
      existing: null,
      suggestedAction: "new",
    };
  });

  return {
    rows: staged,
    unmappedHeaders,
    summary: {
      total: staged.length,
      new: staged.filter((r) => r.match === "new").length,
      exactUnchanged: staged.filter((r) => r.match === "exact_unchanged").length,
      exactChanged: staged.filter((r) => r.match === "exact_changed").length,
      possible: staged.filter((r) => r.match === "possible").length,
      failed: staged.filter((r) => r.match === "failed").length,
    },
  };
}
