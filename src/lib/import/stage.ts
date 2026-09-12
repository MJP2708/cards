import type { StoreDb } from "@/lib/db/scoped";
import { cardInputSchema, type CardInput } from "@/lib/validation/card";
import { validateAttributes } from "@/lib/validation/attributes";
import { getCategories, type CategoryDTO } from "@/lib/categories";
import type { RawRow } from "./worksheet";

export type RowStatus = "ready" | "review" | "failed";

export type StagedRow = {
  rowNumber: number;
  status: RowStatus;
  /** Why this row is not `ready` — shown verbatim in the staging table. */
  issues: string[];
  card: (Partial<CardInput> & { category?: string }) | null;
  duplicateOf: { id: string; name: string; series: string; quantity: number } | null;
};

export type StagedImport = {
  rows: StagedRow[];
  unmappedHeaders: string[];
  sheetName: string | null;
  summary: { total: number; ready: number; review: number; failed: number; duplicates: number };
};

const STATUS_ALIASES: Record<string, CardInput["status"]> = {
  instock: "In Stock",
  available: "In Stock",
  unsold: "In Stock",
  sold: "Sold",
  reserved: "Reserved",
  onhold: "On Hold",
  hold: "On Hold",
};

function normalizeStatus(value: string | undefined): { status: CardInput["status"]; issue?: string } {
  if (!value) return { status: "In Stock" };
  const key = value.toLowerCase().replace(/[^a-z]/g, "");
  const mapped = STATUS_ALIASES[key];
  if (mapped) return { status: mapped };
  return { status: "In Stock", issue: `Unrecognised status "${value}" — defaulted to In Stock.` };
}

/** Money columns often arrive as "฿1,200" or "1,200.00". */
function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function duplicateKey(name: string, series: string, cardNumber: string | null | undefined) {
  return [name, series, cardNumber ?? ""].map((part) => part.trim().toLowerCase()).join("|");
}

export async function stageRows(
  db: StoreDb,
  rawRows: RawRow[],
  meta: { unmappedHeaders: string[]; sheetName: string | null }
): Promise<StagedImport> {
  const categories = await getCategories(db);
  const byKey = new Map<string, CategoryDTO>();
  for (const category of categories) {
    byKey.set(category.key.toLowerCase(), category);
    byKey.set(category.displayName.toLowerCase(), category);
  }

  // One query for duplicate detection rather than a lookup per row.
  const existing = await db.card.findMany({
    select: { id: true, name: true, series: true, cardNumber: true, quantity: true },
  });
  const existingByKey = new Map(existing.map((card) => [duplicateKey(card.name, card.series, card.cardNumber), card]));

  const rows: StagedRow[] = rawRows.map((raw) => {
    const issues: string[] = [];
    const values = raw.values;

    const categoryInput = values.category ?? "";
    const category = byKey.get(categoryInput.trim().toLowerCase());
    if (!category) {
      return {
        rowNumber: raw.rowNumber,
        status: "failed",
        issues: [
          categoryInput
            ? `Unknown category "${categoryInput}". Known: ${categories.map((c) => c.key).join(", ")}.`
            : "Missing Category.",
        ],
        card: null,
        duplicateOf: null,
      };
    }

    const { status, issue: statusIssue } = normalizeStatus(values.status);
    if (statusIssue) issues.push(statusIssue);

    const year = parseNumber(values.year);
    if (values.year && year === null) issues.push(`Could not read Year "${values.year}".`);

    const costBasis = parseNumber(values.costBasis);
    const askingPrice = parseNumber(values.askingPrice);
    if (values.costBasis && costBasis === null) issues.push(`Could not read Cost Basis "${values.costBasis}".`);
    if (values.askingPrice && askingPrice === null) issues.push(`Could not read Asking Price "${values.askingPrice}".`);

    const quantity = parseNumber(values.quantity);

    // Category-specific attributes come from the category's own field schema, so a
    // custom category added later picks up its columns without a code change.
    const attributes: Record<string, string> = {};
    for (const field of category.fieldSchema) {
      if (field.kind !== "attribute") continue;
      const value = values[field.key];
      if (value) attributes[field.key] = value;
    }

    const candidate = {
      category: category.key,
      name: values.name ?? "",
      series: values.series ?? "",
      year: year ?? null,
      cardNumber: values.cardNumber ?? null,
      cardType: values.cardType ?? null,
      rarity: values.rarity ?? null,
      grade: values.grade ?? null,
      costBasis: costBasis ?? 0,
      askingPrice: askingPrice ?? 0,
      quantity: quantity !== null && quantity >= 1 ? Math.round(quantity) : 1,
      status,
      qrCode: values.qrCode ?? null,
      buyerNote: values.buyerNote ?? null,
      attributes,
    };

    const parsed = cardInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const fieldErrors = parsed.error.issues.map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`);
      return {
        rowNumber: raw.rowNumber,
        status: "failed",
        issues: [...issues, ...fieldErrors],
        card: candidate,
        duplicateOf: null,
      };
    }

    // Missing required attributes are reviewable, not fatal — the row still imports.
    const attributeIssues = validateAttributes(category.fieldSchema, attributes);
    issues.push(...attributeIssues);

    const duplicate = existingByKey.get(duplicateKey(candidate.name, candidate.series, candidate.cardNumber)) ?? null;
    if (duplicate) {
      issues.push(
        `Looks like an existing card (${duplicate.name} — ${duplicate.series}, qty ${duplicate.quantity}). Choose merge or add as new.`
      );
    }

    return {
      rowNumber: raw.rowNumber,
      status: issues.length > 0 ? "review" : "ready",
      issues,
      card: parsed.data,
      duplicateOf: duplicate,
    };
  });

  return {
    rows,
    unmappedHeaders: meta.unmappedHeaders,
    sheetName: meta.sheetName,
    summary: {
      total: rows.length,
      ready: rows.filter((r) => r.status === "ready").length,
      review: rows.filter((r) => r.status === "review").length,
      failed: rows.filter((r) => r.status === "failed").length,
      duplicates: rows.filter((r) => r.duplicateOf).length,
    },
  };
}
