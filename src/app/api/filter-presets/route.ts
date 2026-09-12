import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { requireStore } from "@/lib/auth/guards";

export async function GET(request: Request) {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const presets = await gate.db.filterPreset.findMany({
    where: category ? { OR: [{ category }, { category: null }] } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(presets);
}

const createSchema = z.object({
  name: z.string().min(1),
  category: z.string().nullable(),
  filterJson: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = createSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const preset = await gate.db.filterPreset.create({
    data: {
      storeId: gate.user.storeId,
      ...parsed.data,
      filterJson: parsed.data.filterJson as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json(preset, { status: 201 });
}
