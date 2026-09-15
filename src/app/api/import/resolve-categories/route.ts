import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { getCategories } from "@/lib/categories";
import { distinctColumnValues, suggestCategoryValues } from "@/lib/import/mapping";
import { requireOwner } from "@/lib/auth/guards";

const bodySchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.object({ rowNumber: z.number().int(), cells: z.array(z.string()) })),
  /** The header the user mapped to `category`, or null if they mapped none. */
  categoryHeader: z.string().nullable(),
});

/**
 * Step 2: resolve the *values* inside the category column.
 *
 * Column mapping says which column means "category"; this says what the words in
 * it mean. A seller writing "Basketball" where this store calls it "NBA" is the
 * normal case, not an error — so each distinct value gets its own decision,
 * and anything unmatched is reported rather than guessed at.
 */
export async function POST(request: Request) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;

  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = bodySchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const categories = await getCategories(gate.db);
  const values = distinctColumnValues(parsed.data.headers, parsed.data.rows, parsed.data.categoryHeader);

  return NextResponse.json({
    values: suggestCategoryValues(values, categories),
    categories: categories.map((c) => ({ key: c.key, displayName: c.displayName })),
  });
}
