import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCategories } from "@/lib/categories";
import { fieldSchemaSchema, themeTokensSchema } from "@/lib/fieldSchema";
import { z } from "zod";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";

export async function GET() {
  const categories = await getCategories();
  return NextResponse.json(categories);
}

const createCategorySchema = z.object({
  key: z.string().min(1),
  displayName: z.string().min(1),
  icon: z.string().optional(),
  fieldSchema: fieldSchemaSchema,
  themeTokens: themeTokensSchema,
});

export async function POST(request: Request) {
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = createCategorySchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const maxSort = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const category = await prisma.category.create({
    data: {
      ...parsed.data,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      isBuiltIn: false,
    },
  });
  return NextResponse.json(category, { status: 201 });
}
