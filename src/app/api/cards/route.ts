import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { cardInputSchema } from "@/lib/validation/card";
import { validateAttributes } from "@/lib/validation/attributes";
import { getCategoryByKey } from "@/lib/categories";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";

const SORTABLE_FIELDS = new Set([
  "name",
  "askingPrice",
  "costBasis",
  "rarity",
  "series",
  "grade",
  "status",
  "dateAdded",
  "dateSold",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const sort = searchParams.get("sort") ?? "dateAdded";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const packed = searchParams.get("packed");
  const isHot = searchParams.get("isHot");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");

  const where: Prisma.CardWhereInput = {};
  if (category && category !== "all") {
    where.category = { equals: category, mode: "insensitive" };
  }
  if (status) where.status = status;
  if (packed) where.packed = packed === "true";
  if (isHot) where.isHot = isHot === "true";
  if (minPrice || maxPrice) {
    where.askingPrice = {
      ...(minPrice ? { gte: Number(minPrice) } : {}),
      ...(maxPrice ? { lte: Number(maxPrice) } : {}),
    };
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { series: { contains: q, mode: "insensitive" } },
      { cardNumber: { contains: q, mode: "insensitive" } },
    ];
  }

  const orderBy = SORTABLE_FIELDS.has(sort) ? { [sort]: order } : { dateAdded: "desc" as const };

  const cards = await prisma.card.findMany({ where, orderBy });
  return NextResponse.json(cards);
}

export async function POST(request: Request) {
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = cardInputSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const category = await getCategoryByKey(parsed.data.category);
  if (!category) {
    return NextResponse.json({ error: `Unknown category "${parsed.data.category}"` }, { status: 400 });
  }
  const attrErrors = validateAttributes(category.fieldSchema, parsed.data.attributes);
  if (attrErrors.length > 0) {
    return NextResponse.json({ error: { attributes: attrErrors } }, { status: 400 });
  }

  const data = {
    ...parsed.data,
    category: category.key,
    attributes: parsed.data.attributes as Prisma.InputJsonValue,
  };

  // Offline-created cards replay with their client-generated id so it never needs
  // remapping once synced; upsert makes a retried replay after a dropped response idempotent.
  const card = parsed.data.id
    ? await prisma.card.upsert({ where: { id: parsed.data.id }, create: data, update: {} })
    : await prisma.card.create({ data });
  return NextResponse.json(card, { status: 201 });
}
