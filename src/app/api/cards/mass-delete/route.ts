import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth/guards";
import { executeMassDelete, planMassDelete } from "@/lib/cards/massDelete";

/** Typed by hand before anything is removed. Nothing about this should be one click. */
const CONFIRM_PHRASE = "DELETE";

const bodySchema = z.object({
  category: z.string().optional(),
  status: z.string().optional(),
  /** Preview unless true. */
  apply: z.boolean().optional(),
  /** Must equal CONFIRM_PHRASE when applying. */
  confirm: z.string().optional(),
  /** Start numbering again at 1. Only honoured when the store ends up empty. */
  resetNumbering: z.boolean().optional(),
});

/**
 * Deletes inventory in bulk.
 *
 * Owner-only, and a preview by default: the response tells you exactly what
 * would go, including which cards are held back because they have sales, before
 * you can ask for it to happen.
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

  const { apply, confirm, resetNumbering, ...filter } = parsed.data;
  const plan = await planMassDelete(gate.db, filter);

  if (!apply) return NextResponse.json({ plan, applied: null });

  if (confirm !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { error: `Type ${CONFIRM_PHRASE} to confirm. Nothing has been deleted.` },
      { status: 400 }
    );
  }

  const applied = await executeMassDelete(gate.db, gate.user.storeId, filter, { resetNumbering });
  return NextResponse.json({ plan, applied });
}
