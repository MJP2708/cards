import Papa from "papaparse";
import type { CategoryDTO } from "@/lib/categories";
import type { CardInput } from "@/lib/validation/card";

const CORE_COLUMNS = [
  "name",
  "series",
  "year",
  "cardNumber",
  "cardType",
  "rarity",
  "grade",
  "costBasis",
  "askingPrice",
  "quantity",
  "status",
  "qrCode",
  "buyerNote",
] as const;

export function csvTemplateFor(category: CategoryDTO): string {
  const attributeKeys = category.fieldSchema.filter((f) => f.kind === "attribute").map((f) => f.key);
  const header = [...CORE_COLUMNS, ...attributeKeys];
  return Papa.unparse({ fields: header, data: [] });
}

export function parseCsvForCategory(
  csvText: string,
  category: CategoryDTO
): { rows: Partial<CardInput>[]; errors: string[] } {
  const attributeKeys = new Set(category.fieldSchema.filter((f) => f.kind === "attribute").map((f) => f.key));
  const result = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  const errors = result.errors.map((e) => `Row ${e.row ?? "?"}: ${e.message}`);

  const rows: Partial<CardInput>[] = result.data.map((raw) => {
    const attributes: Record<string, string> = {};
    const core: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (attributeKeys.has(key)) attributes[key] = value;
      else core[key] = value;
    }
    return {
      name: core.name as string,
      series: core.series as string,
      year: core.year ? Number(core.year) : null,
      cardNumber: (core.cardNumber as string) || null,
      cardType: (core.cardType as string) || null,
      rarity: (core.rarity as string) || null,
      grade: (core.grade as string) || null,
      costBasis: Number(core.costBasis ?? 0),
      askingPrice: Number(core.askingPrice ?? 0),
      quantity: core.quantity ? Number(core.quantity) : 1,
      status: (core.status as CardInput["status"]) || "In Stock",
      qrCode: (core.qrCode as string) || null,
      buyerNote: (core.buyerNote as string) || null,
      attributes,
    };
  });

  return { rows, errors };
}
