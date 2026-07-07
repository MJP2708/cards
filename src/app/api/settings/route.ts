import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";

export async function GET() {
  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return NextResponse.json(settings);
}

const updateSchema = z.object({
  minMarginPct: z.number().min(0).optional(),
  usdExchangeRate: z.number().min(0).optional(),
});

export async function PATCH(request: Request) {
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = updateSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {
      ...parsed.data,
      ...(parsed.data.usdExchangeRate !== undefined ? { exchangeRateFetchedAt: new Date() } : {}),
    },
    create: { id: "singleton", ...parsed.data },
  });
  return NextResponse.json(settings);
}
