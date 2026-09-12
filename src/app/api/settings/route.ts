import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { requireAdmin, requireUser } from "@/lib/auth/guards";

export async function GET() {
  const gate = await requireUser();
  if ("response" in gate) return gate.response;
  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return NextResponse.json(settings);
}

const updateSchema = z.object({
  // Renaming the store here is what makes the header, tab title and report
  // wordmark follow along — they all read this row at render time.
  storeName: z.string().trim().min(1).optional(),
  minMarginPct: z.number().min(0).optional(),
  usdExchangeRate: z.number().min(0).optional(),
});

export async function PATCH(request: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
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
