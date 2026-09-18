import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth/guards";
import { isRenameError, renameCategory } from "@/lib/categoryRename";

type Params = { params: Promise<{ id: string }> };

const renameSchema = z
  .object({
    key: z.string().optional(),
    displayName: z.string().optional(),
  })
  // Refuse a request that asks for nothing, rather than reporting a successful
  // rename that changed no field.
  .refine((value) => value.key !== undefined || value.displayName !== undefined, {
    message: "Provide a key, a display name, or both.",
  });

/**
 * Renames a category. Owner-only: a key rename rewrites every card in the
 * category, which is squarely "reshaping the store" rather than running it.
 */
export async function PATCH(request: Request, { params }: Params) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;
  const { id } = await params;

  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = renameSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const result = await renameCategory(gate.db, id, parsed.data);
  if (isRenameError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
