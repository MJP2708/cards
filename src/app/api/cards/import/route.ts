import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { cardInputSchema } from "@/lib/validation/card";
import { validateAttributes } from "@/lib/validation/attributes";
import { getCategoryByKey } from "@/lib/categories";
import { z } from "zod";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth/guards";
import { allocateLookupNumbers } from "@/lib/lookupNumber";

const importSchema = z.object({
  category: z.string().min(1),
  rows: z.array(cardInputSchema.omit({ category: true })),
});

export async function POST(request: Request) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = importSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const category = await getCategoryByKey(gate.db, parsed.data.category);
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

  // One block for the whole batch, in row order, same as the worksheet importer.
  const numbers = await allocateLookupNumbers(gate.db, gate.user.storeId, parsed.data.rows.length);

  const result = await gate.db.card.createMany({
    data: parsed.data.rows.map((row, index) => ({
      ...row,
      storeId: gate.user.storeId,
      category: category.key,
      lookupNumber: numbers[index],
      attributes: row.attributes as Prisma.InputJsonValue | undefined,
    })),
  });
  return NextResponse.json({ count: result.count }, { status: 201 });
}
