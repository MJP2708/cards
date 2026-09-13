import { NextResponse } from "next/server";
import { getCategories } from "@/lib/categories";
import { ensureDefaultCategories } from "@/lib/defaultCategories";
import { fieldSchemaSchema, themeTokensSchema } from "@/lib/fieldSchema";
import { z } from "zod";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { requireOwner, requireStore } from "@/lib/auth/guards";

export async function GET() {
  // Categories are per-store now, so this needs a session: previously it had no
  // gate at all and returned the install's whole category list to anyone.
  const gate = await requireStore();
  if ("response" in gate) return gate.response;
  // Repairs stores created before built-in categories were seeded at sign-up.
  // No-op once a store has any category of its own.
  await ensureDefaultCategories(gate.db, gate.user.storeId);
  const categories = await getCategories(gate.db);
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
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = createCategorySchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const maxSort = await gate.db.category.aggregate({ _max: { sortOrder: true } });
  const category = await gate.db.category.create({
    data: {
      ...parsed.data,
      storeId: gate.user.storeId,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      isBuiltIn: false,
    },
  });
  return NextResponse.json(category, { status: 201 });
}
