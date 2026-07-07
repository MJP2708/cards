import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { cardUpdateSchema } from "@/lib/validation/card";
import { validateAttributes } from "@/lib/validation/attributes";
import { getCategoryByKey } from "@/lib/categories";
import { readJsonBody, invalidJsonResponse, isPrismaNotFoundError, notFoundResponse } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const card = await prisma.card.findUnique({
    where: { id },
    include: { sales: { orderBy: { timestamp: "desc" } }, priceComps: { orderBy: { fetchedAt: "desc" } } },
  });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(card);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = cardUpdateSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.category || parsed.data.attributes) {
    const existing = await prisma.card.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const categoryKey = parsed.data.category ?? existing.category;
    const category = await getCategoryByKey(categoryKey);
    if (!category) {
      return NextResponse.json({ error: `Unknown category "${categoryKey}"` }, { status: 400 });
    }
    const mergedAttributes = {
      ...(existing.attributes as Record<string, unknown> | null),
      ...(parsed.data.attributes ?? {}),
    };
    const attrErrors = validateAttributes(category.fieldSchema, mergedAttributes);
    if (attrErrors.length > 0) {
      return NextResponse.json({ error: { attributes: attrErrors } }, { status: 400 });
    }
  }

  try {
    const card = await prisma.card.update({
      where: { id },
      data: { ...parsed.data, attributes: parsed.data.attributes as Prisma.InputJsonValue | undefined },
    });
    return NextResponse.json(card);
  } catch (error) {
    if (isPrismaNotFoundError(error)) return notFoundResponse();
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.card.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isPrismaNotFoundError(error)) return notFoundResponse();
    throw error;
  }
}
