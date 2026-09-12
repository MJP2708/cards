import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { readJsonBody, invalidJsonResponse } from "@/lib/api";
import { requireOwner, requireStore } from "@/lib/auth/guards";

/**
 * The response merges the store's name with its preferences. They live in
 * different tables — the name on `Store` so every member of a shop sees the same
 * one, the rest on a per-store `Settings` row — but the settings screen treats
 * them as one form, so the API presents them as one object.
 */
export async function GET() {
  const gate = await requireStore();
  if ("response" in gate) return gate.response;

  const [settings, store] = await Promise.all([
    // One Settings row per store, created on first read.
    gate.db.settings.upsert({
      where: { storeId: gate.user.storeId },
      update: {},
      create: { storeId: gate.user.storeId },
    }),
    prisma.store.findUnique({ where: { id: gate.user.storeId }, select: { name: true } }),
  ]);

  return NextResponse.json({ ...settings, storeName: store?.name ?? "" });
}

const updateSchema = z.object({
  // Renaming the store is what makes the header, tab title and report wordmark
  // follow along — they all read Store.name at render time.
  storeName: z.string().trim().min(1).optional(),
  minMarginPct: z.number().min(0).optional(),
  usdExchangeRate: z.number().min(0).optional(),
});

export async function PATCH(request: Request) {
  const gate = await requireOwner();
  if ("response" in gate) return gate.response;
  const json = await readJsonBody(request);
  if (!json.ok) return invalidJsonResponse();
  const parsed = updateSchema.safeParse(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { storeName, ...preferences } = parsed.data;

  const [settings, store] = await Promise.all([
    gate.db.settings.upsert({
      where: { storeId: gate.user.storeId },
      update: {
        ...preferences,
        ...(preferences.usdExchangeRate !== undefined ? { exchangeRateFetchedAt: new Date() } : {}),
      },
      create: { storeId: gate.user.storeId, ...preferences },
    }),
    storeName === undefined
      ? prisma.store.findUnique({ where: { id: gate.user.storeId }, select: { name: true } })
      : prisma.store.update({
          where: { id: gate.user.storeId },
          data: { name: storeName },
          select: { name: true },
        }),
  ]);

  return NextResponse.json({ ...settings, storeName: store?.name ?? "" });
}
