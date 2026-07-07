"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type FilterPresetValues = {
  status?: string;
  sort?: string;
  order?: "asc" | "desc";
  minPrice?: string;
  maxPrice?: string;
};

export type FilterPresetDTO = {
  id: string;
  name: string;
  category: string | null;
  filterJson: FilterPresetValues;
  createdAt: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export function useFilterPresets(category?: string) {
  return useQuery({
    queryKey: ["filterPresets", category],
    queryFn: () => fetchJson<FilterPresetDTO[]>(`/api/filter-presets${category ? `?category=${category}` : ""}`),
  });
}

export function useCreateFilterPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; category: string | null; filterJson: FilterPresetValues }) =>
      fetchJson<FilterPresetDTO>("/api/filter-presets", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["filterPresets"] }),
  });
}

export function useDeleteFilterPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson<{ ok: true }>(`/api/filter-presets/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["filterPresets"] }),
  });
}
