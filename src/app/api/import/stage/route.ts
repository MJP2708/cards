import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { getCategories } from "@/lib/categories";
import { stageRows } from "@/lib/import/stage";
import { requireOwner } from "@/lib/auth/guards";

const bodySchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.object({ rowNumber: z.number().int(), cells: z.array(z.string()) })).min(1),
  /** appFieldKey -> worksheet header. null means the user chose "Not mapped". */
  fieldMap: z.record(z.string(), z.string().nullable()),
  /** lowercased raw category value -> this store's category key. */
  categoryMap: z.record(z.string(), z.string()),
});

/**
 * Step 3: interpret the rows through the confirmed mapping and say, per row,
 * what committing would do to this store's inventory.
 *
 * Writes nothing — this is the preview the staging screen renders, and it can be
 * re-run as many times as the user wants while they adjust their choices.
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
  const staged = await stageRows(gate.db, categories, parsed.data);
  return NextResponse.json(staged);
}
