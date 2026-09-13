import { NBA_FIELDS, FOOTBALL_FIELDS, type FieldSchema, type ThemeTokens } from "@/lib/fieldSchema";
import type { StoreDb } from "@/lib/db/scoped";

// accent is used as a solid fill behind white text (buttons, active tabs,
// badges) throughout the app, so it must itself clear WCAG AA (4.5:1) against
// white — the original bright brand tones (#F97316, #16A34A) only hit
// 2.80:1/3.30:1. accent/accentDark are the two darker, AA-safe steps.
export const NBA_THEME: ThemeTokens = {
  accent: "#C2410C", // 5.18:1 vs white
  accentDark: "#9A3412",
  secondary: "#18181B",
  surface: "#FFF7ED",
  motif: "hardwood",
  headerFont: "oswald",
  iconSet: "basketball",
};

export const FOOTBALL_THEME: ThemeTokens = {
  accent: "#15803D", // 5.02:1 vs white
  accentDark: "#166534",
  secondary: "#FFFFFF",
  surface: "#F0FDF4",
  motif: "pitch",
  headerFont: "barlowCondensed",
  iconSet: "soccer",
};

/**
 * Every store starts with these.
 *
 * Categories became per-store with multi-tenancy, which means a brand new store
 * has none unless it is given some — and a store with no categories cannot add a
 * card or import a worksheet at all, because both match rows against the known
 * category list. These are the same two the single-tenant install shipped with.
 */
export const BUILT_IN_CATEGORIES: {
  key: string;
  displayName: string;
  icon: string;
  sortOrder: number;
  fieldSchema: FieldSchema;
  themeTokens: ThemeTokens;
  isBuiltIn: boolean;
}[] = [
  {
    key: "NBA",
    displayName: "NBA",
    icon: "basketball",
    sortOrder: 1,
    fieldSchema: NBA_FIELDS,
    themeTokens: NBA_THEME,
    isBuiltIn: true,
  },
  {
    key: "Football",
    displayName: "Football",
    icon: "football",
    sortOrder: 2,
    fieldSchema: FOOTBALL_FIELDS,
    themeTokens: FOOTBALL_THEME,
    isBuiltIn: true,
  },
];

/** The same rows shaped for a plain (unscoped) client, e.g. inside a signup transaction. */
export function buildDefaultCategoryRows(storeId: string) {
  return BUILT_IN_CATEGORIES.map((category) => ({ ...category, storeId }));
}

/**
 * Gives a store its built-in categories if it has none.
 *
 * Idempotent, and safe to call concurrently: the `(storeId, key)` unique index
 * plus `skipDuplicates` means a second caller adds nothing. Returns how many it
 * created, so callers can tell a repair from a no-op.
 */
export async function ensureDefaultCategories(db: StoreDb, storeId: string): Promise<number> {
  const existing = await db.category.count();
  if (existing > 0) return 0;

  const result = await db.category.createMany({
    data: BUILT_IN_CATEGORIES.map((category) => ({ ...category, storeId })),
    skipDuplicates: true,
  });
  return result.count;
}
