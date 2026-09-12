import type { StoreDb } from "@/lib/db/scoped";
import type { FieldSchema, ThemeTokens } from "@/lib/fieldSchema";

export type CategoryDTO = {
  id: string;
  key: string;
  displayName: string;
  icon: string | null;
  sortOrder: number;
  fieldSchema: FieldSchema;
  themeTokens: ThemeTokens;
  isBuiltIn: boolean;
};

/**
 * Categories are per-store, so these take the caller's scoped client rather than
 * reaching for the shared one — passing `db` is what keeps one shop's custom
 * categories and themes out of another's.
 */
export async function getCategories(db: StoreDb): Promise<CategoryDTO[]> {
  const rows = await db.category.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({
    ...r,
    fieldSchema: r.fieldSchema as unknown as FieldSchema,
    themeTokens: r.themeTokens as unknown as ThemeTokens,
  }));
}

export async function getCategoryByKey(db: StoreDb, key: string): Promise<CategoryDTO | null> {
  const row = await db.category.findFirst({
    where: { key: { equals: key, mode: "insensitive" } },
  });
  if (!row) return null;
  return {
    ...row,
    fieldSchema: row.fieldSchema as unknown as FieldSchema,
    themeTokens: row.themeTokens as unknown as ThemeTokens,
  };
}
