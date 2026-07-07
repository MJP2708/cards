import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { cardInputSchema } from "@/lib/validation/card";
import { validateAttributes } from "@/lib/validation/attributes";
import { getCategoryByKey } from "@/lib/categories";
import { z } from "zod";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";

const importSchema = z.object({
  category: z.string().min(1),
  rows: z.array(cardInputSchema.omit({ category: true })),
});

export async function POST(request: Request) {
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = importSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const category = await getCategoryByKey(parsed.data.category);
  if (!category) {
    return NextResponse.json({ error: `Unknown category "${parsed.data.category}"` }, { status: 400 });
  }

  const errors: { row: number; errors: string[] }[] = [];
  parsed.data.rows.forEach((row, index) => {
    const attrErrors = validateAttributes(category.fieldSchema, row.attributes);
    if (attrErrors.length > 0) errors.push({ row: index + 1, errors: attrErrors });
  });
  if (errors.length > 0) {
    return NextResponse.json({ error: { rows: errors } }, { status: 400 });
  }

  const result = await prisma.card.createMany({
    data: parsed.data.rows.map((row) => ({
      ...row,
      category: category.key,
      attributes: row.attributes as Prisma.InputJsonValue | undefined,
    })),
  });
  return NextResponse.json({ count: result.count }, { status: 201 });
}
