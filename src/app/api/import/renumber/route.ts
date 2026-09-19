import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth/guards";
import { getCategories } from "@/lib/categories";
import { applyRenumber, planRenumber } from "@/lib/import/renumber";

const bodySchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.object({ rowNumber: z.number().int(), cells: z.array(z.string()) })).min(1),
  fieldMap: z.record(z.string(), z.string().nullable()),
  categoryMap: z.record(z.string(), z.string()),
  /**
   * Preview by default. Renumbering rewrites identifiers the shop is reading off
   * physical sleeves, so it never happens as a side effect of looking.
   */
  apply: z.boolean().optional(),
});

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
  const plan = await planRenumber(gate.db, categories, parsed.data);

  if (!parsed.data.apply) return NextResponse.json({ plan, applied: null });

  const assignments = plan.rows
    .filter((row) => row.status === "renumber" && row.card && row.lookupNumber !== null)
    .map((row) => ({ cardId: row.card!.id, lookupNumber: row.lookupNumber! }));

  const applied = await applyRenumber(gate.db, gate.user.storeId, assignments);
  return NextResponse.json({ plan, applied });
}
