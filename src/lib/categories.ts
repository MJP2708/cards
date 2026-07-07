import { prisma } from "@/lib/prisma";
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

export async function getCategories(): Promise<CategoryDTO[]> {
  const rows = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({
    ...r,
    fieldSchema: r.fieldSchema as unknown as FieldSchema,
    themeTokens: r.themeTokens as unknown as ThemeTokens,
  }));
}

export async function getCategoryByKey(key: string): Promise<CategoryDTO | null> {
  const row = await prisma.category.findFirst({
    where: { key: { equals: key, mode: "insensitive" } },
  });
  if (!row) return null;
  return {
    ...row,
    fieldSchema: row.fieldSchema as unknown as FieldSchema,
    themeTokens: row.themeTokens as unknown as ThemeTokens,
  };
}
