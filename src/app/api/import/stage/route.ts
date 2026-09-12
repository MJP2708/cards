import { NextResponse } from "next/server";
import { parseWorksheet } from "@/lib/import/worksheet";
import { stageRows } from "@/lib/import/stage";
import { enrichmentAvailability } from "@/lib/import/enrich";
import { requireOwner } from "@/lib/auth/guards";

const MAX_BYTES = 5 * 1024 * 1024;

/** Parses and validates an uploaded worksheet. Writes nothing — this drives the preview. */
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
    const staged = await stageRows(gate.db, parsed.rows, {
      unmappedHeaders: parsed.unmappedHeaders,
      sheetName: parsed.sheetName,
    });
    return NextResponse.json({
      fileName: file.name,
      ...staged,
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
