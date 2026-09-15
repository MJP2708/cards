import { NextResponse } from "next/server";
import { parseWorksheet } from "@/lib/import/worksheet";
import { buildFieldCatalog } from "@/lib/import/fields";
import {
  headerSignature,
  signatureSimilarity,
  suggestMapping,
  suggestionsToFieldMap,
  TEMPLATE_MATCH_SCORE,
  type FieldMap,
} from "@/lib/import/mapping";
import { ensureDefaultCategories } from "@/lib/defaultCategories";
import { getCategories } from "@/lib/categories";
import { enrichmentAvailability } from "@/lib/import/enrich";
import { requireOwner } from "@/lib/auth/guards";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Step 1 of the import wizard: read the file exactly as it is and propose a
 * column mapping. Writes nothing.
 *
 * The parsed rows go back to the client and are posted to `/stage` and `/commit`
 * with the confirmed mapping, so changing the mapping re-previews instantly and
 * no half-finished upload is ever persisted server-side.
 */
export async function POST(request: Request) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart file upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is larger than 5MB." }, { status: 400 });
  }
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return NextResponse.json({ error: "Upload a .xlsx or .csv file." }, { status: 400 });
  }

  try {
    const parsed = await parseWorksheet({ name: file.name, buffer: await file.arrayBuffer() });
    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: "That file has a header row but no data rows." }, { status: 400 });
    }

    // A store with no categories can't resolve any row; make sure it has its own.
    await ensureDefaultCategories(gate.db, gate.user.storeId);
    const categories = await getCategories(gate.db);
    const fields = buildFieldCatalog(categories);

    const suggestions = suggestMapping(parsed.headers, fields);
    const signature = headerSignature(parsed.headers);

    // A saved template beats fuzzy matching when the sheet is recognisably the
    // same shape — but it is applied *into the confirmation screen*, never
    // instead of it, so a stale template can still be seen and corrected.
    const saved = await gate.db.importMapping.findMany({ orderBy: { lastUsedAt: "desc" } });
    const scored = saved
      .map((template) => ({
        id: template.id,
        name: template.name,
        fieldMap: template.fieldMap as FieldMap,
        categoryMap: (template.categoryMap ?? {}) as Record<string, string>,
        score: signatureSimilarity(signature, template.headerSignature),
      }))
      .sort((a, b) => b.score - a.score);

    const matched = scored[0] && scored[0].score >= TEMPLATE_MATCH_SCORE ? scored[0] : null;

    return NextResponse.json({
      fileName: file.name,
      sheetName: parsed.sheetName,
      headers: parsed.headers,
      rows: parsed.rows,
      headerSignature: signature,
      fields,
      suggestions,
      fieldMap: matched ? matched.fieldMap : suggestionsToFieldMap(suggestions),
      appliedTemplate: matched ? { id: matched.id, name: matched.name, score: matched.score } : null,
      templates: scored.map(({ id, name, score }) => ({ id, name, score })),
      categories: categories.map((c) => ({ key: c.key, displayName: c.displayName })),
      // Surfaced up-front so a missing key is obvious before committing, not after.
      enrichment: enrichmentAvailability(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read that file." },
      { status: 400 }
    );
  }
}
