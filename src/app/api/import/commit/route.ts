import { NextResponse, after } from "next/server";
import { z } from "zod";
import { cardInputSchema } from "@/lib/validation/card";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { commitImport } from "@/lib/import/commit";
import { enrichNextChunk } from "@/lib/import/enrich";
import { requireOwner } from "@/lib/auth/guards";

const commitSchema = z.object({
  fileName: z.string().min(1),
  rows: z
    .array(
      z.object({
        card: cardInputSchema,
        /** Supplied by the spreadsheet; omitted means allocate the next one. */
        lookupNumber: z.number().int().min(1).optional().nullable(),
        /**
         * new    — create a separate card
         * update — set quantity/price/status on the matched card
         * merge  — add this row's quantity to the matched card's
         * skip   — do nothing (also where an unresolved "possible match" lands)
         */
        action: z.enum(["new", "update", "merge", "skip"]).default("new"),
        existingId: z.string().optional().nullable(),
        needsReview: z.boolean().optional(),
        reviewReason: z.string().optional().nullable(),
      })
    )
    .min(1),
  /** Present when the user ticked "save this mapping for next time". */
  saveTemplate: z
    .object({
      name: z.string().min(1).max(80),
      headerSignature: z.string().min(1),
      fieldMap: z.record(z.string(), z.string().nullable()),
      categoryMap: z.record(z.string(), z.string()),
    })
    .optional()
    .nullable(),
});

/**
 * The only endpoint in the import flow that writes.
 *
 * Everything before this is preview, so a user who closes the tab on the staging
 * screen has changed nothing.
 */
export async function POST(request: Request) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;

  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = commitSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { fileName, rows, saveTemplate } = parsed.data;
  if (rows.every((row) => row.action === "skip")) {
    return NextResponse.json({ error: "Every row is set to skip — nothing to import." }, { status: 400 });
  }

  let result;
  try {
    result = await commitImport(gate.db, gate.user.storeId, { fileName, rows, saveTemplate });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Import rolled back — nothing was saved. ${error.message}`
            : "Import rolled back — nothing was saved.",
      },
      { status: 500 }
    );
  }

  const batch = await gate.db.importBatch.findFirst({ where: { id: result.batchId } });

  // Kick off the first chunk once the response is out; the client's progress poller
  // drives the rest, so a long import is never cut short by a function timeout.
  if (result.created > 0) {
    after(async () => {
      try {
        await enrichNextChunk(gate.db, result.batchId);
      } catch {
        // Enrichment is best-effort — the cards are already safely imported.
      }
    });
  }

  return NextResponse.json(
    {
      batch,
      created: result.created,
      updated: result.updated,
      merged: result.merged,
      skipped: result.skipped,
    },
    { status: 201 }
  );
}
