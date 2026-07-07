"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createId } from "@paralleldrive/cuid2";
import type { CardDTO, CardDetailDTO, CardFilters } from "./types";
import type { CardInput } from "@/lib/validation/card";
import { offlineDb, isNetworkError } from "@/lib/offline/db";

function buildQuery(filters: CardFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);
  if (filters.packed !== undefined) params.set("packed", String(filters.packed));
  if (filters.isHot !== undefined) params.set("isHot", String(filters.isHot));
  if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));
  return params.toString();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed (${res.status})`);
  }
  return res.json();
}

// Approximates the /api/cards server-side filtering, for use against the Dexie
// mirror when the network request fails.
function filterCardsOffline(cards: CardDTO[], filters: CardFilters): CardDTO[] {
  let result = cards;
  if (filters.category) {
    result = result.filter((c) => c.category.toLowerCase() === filters.category!.toLowerCase());
  }
  if (filters.status) result = result.filter((c) => c.status === filters.status);
  if (filters.packed !== undefined) result = result.filter((c) => c.packed === filters.packed);
  if (filters.isHot !== undefined) result = result.filter((c) => c.isHot === filters.isHot);
  if (filters.minPrice !== undefined) result = result.filter((c) => c.askingPrice >= filters.minPrice!);
  if (filters.maxPrice !== undefined) result = result.filter((c) => c.askingPrice <= filters.maxPrice!);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    result = result.filter(
      (c) => c.name.toLowerCase().includes(q) || c.series.toLowerCase().includes(q) || c.cardNumber?.toLowerCase().includes(q)
    );
  }
  const sort = filters.sort ?? "dateAdded";
  const order = filters.order ?? "desc";
  result = [...result].sort((a, b) => {
    const av = a[sort as keyof CardDTO];
    const bv = b[sort as keyof CardDTO];
    if (av == null || bv == null) return 0;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return order === "asc" ? cmp : -cmp;
  });
  return result;
}

export function useCards(filters: CardFilters) {
  return useQuery({
    queryKey: ["cards", filters],
    queryFn: async () => {
      try {
        const data = await fetchJson<CardDTO[]>(`/api/cards?${buildQuery(filters)}`);
        offlineDb?.cards.bulkPut(data).catch(() => {});
        return data;
      } catch (err) {
        if (!offlineDb) throw err;
        const cached = await offlineDb.cards.toArray();
        return filterCardsOffline(cached, filters);
      }
    },
  });
}

export function useCard(id: string | undefined) {
  return useQuery({
    queryKey: ["card", id],
    queryFn: () => fetchJson<CardDetailDTO>(`/api/cards/${id}`),
    enabled: !!id,
  });
}

export function useCreateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CardInput): Promise<CardDTO> => {
      try {
        const card = await fetchJson<CardDTO>("/api/cards", { method: "POST", body: JSON.stringify(input) });
        offlineDb?.cards.put(card).catch(() => {});
        return card;
      } catch (err) {
        if (!offlineDb || !isNetworkError(err)) throw err;

        const now = new Date().toISOString();
        const id = createId();
        const optimisticCard: CardDTO = {
          id,
          category: input.category,
          name: input.name,
          series: input.series,
          year: input.year ?? null,
          cardNumber: input.cardNumber ?? null,
          cardType: input.cardType ?? null,
          rarity: input.rarity ?? null,
          grade: input.grade ?? null,
          attributes: input.attributes ?? null,
          costBasis: input.costBasis,
          askingPrice: input.askingPrice,
          quantity: input.quantity ?? 1,
          status: input.status ?? "In Stock",
          photoFront: input.photoFront ?? null,
          photoBack: input.photoBack ?? null,
          qrCode: input.qrCode ?? null,
          packed: input.packed ?? false,
          isHot: input.isHot ?? false,
          hotNote: input.hotNote ?? null,
          researchNotes: null,
          liveStats: null,
          liveStatsFetchedAt: null,
          dateAdded: now,
          dateSold: null,
          soldPrice: null,
          buyerNote: input.buyerNote ?? null,
          createdAt: now,
          updatedAt: now,
        };
        await offlineDb.cards.put(optimisticCard);
        await offlineDb.pendingMutations.add({
          kind: "createCard",
          cardId: id,
          payload: { ...input, id },
          createdAt: Date.now(),
        });
        return optimisticCard;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
  });
}

export function useUpdateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CardInput> }) =>
      fetchJson<CardDTO>(`/api/cards/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      qc.invalidateQueries({ queryKey: ["card", variables.id] });
    },
  });
}

export function useDeleteCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson<{ ok: true }>(`/api/cards/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
  });
}

type MarkSoldInput = {
  cardId: string;
  quantitySold?: number;
  soldPrice: number;
  paymentMethod: string;
  buyerContact?: string;
  buyerNote?: string;
};

export function useMarkSold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MarkSoldInput) => {
      try {
        return await fetchJson("/api/sales", { method: "POST", body: JSON.stringify(input) });
      } catch (err) {
        if (!offlineDb || !isNetworkError(err)) throw err;

        const card = await offlineDb.cards.get(input.cardId);
        if (card) {
          const quantitySold = input.quantitySold ?? 1;
          const remaining = Math.max(0, card.quantity - quantitySold);
          await offlineDb.cards.put({
            ...card,
            quantity: remaining,
            ...(remaining <= 0
              ? { status: "Sold" as const, dateSold: new Date().toISOString(), soldPrice: input.soldPrice }
              : {}),
          });
        }
        await offlineDb.pendingMutations.add({
          kind: "markSold",
          cardId: input.cardId,
          payload: input,
          createdAt: Date.now(),
        });
        return { queued: true };
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

export function useBundleSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      cardIds: string[];
      totalPrice: number;
      paymentMethod: string;
      buyerContact?: string;
    }) => fetchJson("/api/sales/bundle", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

export function useBulkAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      ids: string[];
      action: "delete" | "priceAdjust" | "markPacked" | "markUnpacked";
      payload?: { mode?: "percent" | "fixed"; amount?: number };
    }) => fetchJson<{ count: number }>("/api/cards/bulk", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
  });
}

export function useImportCards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { category: string; rows: Partial<CardInput>[] }) =>
      fetchJson<{ count: number }>("/api/cards/import", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
  });
}
