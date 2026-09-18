"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CategoryDTO } from "@/lib/categories";

async function fetchCategories(): Promise<CategoryDTO[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Failed to load categories");
  return res.json();
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
}

export type RenameCategoryResult = {
  category: { id: string; key: string; displayName: string };
  cardsMoved: number;
  presetsMoved: number;
  templatesUpdated: number;
  warnings: string[];
};

/**
 * Renaming touches cards, saved filters and import templates, so this
 * invalidates those caches too — not just the category list. Without that the
 * inventory list keeps filtering on the old key and reads as empty.
 */
export function useRenameCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; key?: string; displayName?: string }) => {
      const res = await fetch(`/api/categories/${input.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: input.key, displayName: input.displayName }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Rename failed.");
      return body as RenameCategoryResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["cards"] });
      qc.invalidateQueries({ queryKey: ["filterPresets"] });
    },
  });
}
