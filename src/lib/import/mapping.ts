import type { CategoryDTO } from "@/lib/categories";
import { bestMatch, normalizeHeader, similarity } from "./fuzzy";
import { CATEGORY_VALUE_SYNONYMS, type ImportField } from "./fields";

/** appFieldKey -> the worksheet header it reads from. Absent/null = not mapped. */
export type FieldMap = Record<string, string | null>;

export type FieldSuggestion = {
  fieldKey: string;
  header: string | null;
  /** 0..1. Below CONFIDENT it is still offered, but the UI marks it uncertain. */
  score: number;
};

/**
 * A suggestion at or above this is presented as a normal pre-filled choice.
 * Below it, nothing is auto-selected — a wrong default the user skims past is
 * worse than an obvious blank, because the mapping screen is the only place the
 * mistake is catchable.
 */
export const CONFIDENT_SCORE = 0.62;

/** Offered but visibly flagged as a guess. */
export const WEAK_SCORE = 0.45;

/**
 * Assigns headers to fields greedily, best score first.
 *
 * Greedy rather than per-field best-match because the assignment must be
 * one-to-one in both directions: with "Price" and "Purchase Price" in the same
 * sheet, per-field matching hands "Price" to both askingPrice and costBasis.
 * Taking globally-best pairs first gives "Purchase Price" to costBasis (its
 * stronger match) and leaves "Price" for askingPrice.
 */
export function suggestMapping(headers: string[], fields: ImportField[]): FieldSuggestion[] {
  const candidates: { fieldKey: string; header: string; score: number }[] = [];

  for (const field of fields) {
    for (const header of headers) {
      if (!header.trim()) continue;
      const score = Math.max(
        bestMatch(header, field.aliases).score,
        similarity(header, field.label)
      );
      if (score >= WEAK_SCORE) candidates.push({ fieldKey: field.key, header, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const takenFields = new Set<string>();
  const takenHeaders = new Set<string>();
  const chosen = new Map<string, FieldSuggestion>();

  for (const candidate of candidates) {
    if (takenFields.has(candidate.fieldKey) || takenHeaders.has(candidate.header)) continue;
    takenFields.add(candidate.fieldKey);
    takenHeaders.add(candidate.header);
    chosen.set(candidate.fieldKey, {
      fieldKey: candidate.fieldKey,
      header: candidate.header,
      score: candidate.score,
    });
  }

  return fields.map(
    (field) => chosen.get(field.key) ?? { fieldKey: field.key, header: null, score: 0 }
  );
}

export function suggestionsToFieldMap(suggestions: FieldSuggestion[]): FieldMap {
  const map: FieldMap = {};
  for (const suggestion of suggestions) {
    // Weak guesses are reported but not pre-selected — see CONFIDENT_SCORE.
    map[suggestion.fieldKey] = suggestion.score >= CONFIDENT_SCORE ? suggestion.header : null;
  }
  return map;
}

/**
 * A stable identity for "a sheet shaped like this one".
 *
 * Sorted so that reordering columns still matches a saved template — the field
 * map is keyed by header name, not position, so order genuinely does not matter.
 * Adding or renaming a column does change it, which is correct: that mapping
 * really may no longer be right.
 */
export function headerSignature(headers: string[]): string {
  return headers
    .map((header) => normalizeHeader(header))
    .filter(Boolean)
    .sort()
    .join("|");
}

/** How close two signatures are, for auto-applying a saved template. */
export function signatureSimilarity(a: string, b: string): number {
  const left = new Set(a.split("|").filter(Boolean));
  const right = new Set(b.split("|").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  return shared / Math.max(left.size, right.size);
}

/** A saved template is auto-applied at or above this overlap. */
export const TEMPLATE_MATCH_SCORE = 0.8;

export type CategoryValueSuggestion = {
  /** The value exactly as it appears in the sheet. */
  value: string;
  /** Matching category key, or null when nothing in this store fits. */
  categoryKey: string | null;
  score: number;
  rowCount: number;
};

/**
 * Resolves the distinct values of the mapped category column to this store's
 * category keys — the second, value-level half of mapping.
 *
 * Tries the store's own keys and display names first, then the synonym table,
 * because "Basketball" -> "NBA" is a rename no string metric can infer.
 */
export function suggestCategoryValues(
  values: { value: string; rowCount: number }[],
  categories: CategoryDTO[]
): CategoryValueSuggestion[] {
  const names: { name: string; key: string }[] = [];
  for (const category of categories) {
    names.push({ name: category.key, key: category.key });
    if (category.displayName !== category.key) {
      names.push({ name: category.displayName, key: category.key });
    }
  }

  return values.map(({ value, rowCount }) => {
    let best: { categoryKey: string | null; score: number } = { categoryKey: null, score: 0 };

    for (const candidate of names) {
      const score = similarity(value, candidate.name);
      if (score > best.score) best = { categoryKey: candidate.key, score };
    }

    // Synonyms only need to beat a weak direct match, and are scored slightly
    // below an equally-good literal one so a store that really does have a
    // "Basketball" category keeps it over the NBA alias.
    if (best.score < 1) {
      for (const synonym of CATEGORY_VALUE_SYNONYMS[normalizeHeader(value)] ?? []) {
        for (const candidate of names) {
          const score = similarity(synonym, candidate.name) * 0.95;
          if (score > best.score) best = { categoryKey: candidate.key, score };
        }
      }
    }

    return {
      value,
      categoryKey: best.score >= CONFIDENT_SCORE ? best.categoryKey : null,
      score: best.score,
      rowCount,
    };
  });
}

/** Distinct non-empty values of one column, with how many rows carry each. */
export function distinctColumnValues(
  headers: string[],
  rows: { cells: string[] }[],
  header: string | null
): { value: string; rowCount: number }[] {
  if (!header) return [];
  const index = headers.indexOf(header);
  if (index === -1) return [];

  const counts = new Map<string, { value: string; rowCount: number }>();
  for (const row of rows) {
    const raw = (row.cells[index] ?? "").trim();
    if (!raw) continue;
    // Case and spacing differences are not distinct values to the user, but the
    // first spelling seen is what gets shown back to them.
    const key = raw.toLowerCase();
    const existing = counts.get(key);
    if (existing) existing.rowCount++;
    else counts.set(key, { value: raw, rowCount: 1 });
  }
  return [...counts.values()].sort((a, b) => b.rowCount - a.rowCount);
}

/** Reads one mapped field out of a raw row. */
export function valueFor(
  headers: string[],
  cells: string[],
  fieldMap: FieldMap,
  fieldKey: string
): string {
  const header = fieldMap[fieldKey];
  if (!header) return "";
  const index = headers.indexOf(header);
  if (index === -1) return "";
  return (cells[index] ?? "").trim();
}
