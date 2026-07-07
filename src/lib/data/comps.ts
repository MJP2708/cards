"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PriceCompInput } from "@/lib/validation/priceComp";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export function useCreateComp(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PriceCompInput) =>
      fetchJson(`/api/cards/${cardId}/comps`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["card", cardId] }),
  });
}

export function useDeleteComp(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/comps/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["card", cardId] }),
  });
}
