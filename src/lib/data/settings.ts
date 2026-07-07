"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type SettingsDTO = {
  id: string;
  minMarginPct: number;
  usdExchangeRate: number | null;
  exchangeRateFetchedAt: string | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => fetchJson<SettingsDTO>("/api/settings") });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { minMarginPct?: number; usdExchangeRate?: number }) =>
      fetchJson<SettingsDTO>("/api/settings", { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}
