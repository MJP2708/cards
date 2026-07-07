"use client";

import { useQuery } from "@tanstack/react-query";
import type { CategoryDTO } from "@/lib/categories";

async function fetchCategories(): Promise<CategoryDTO[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Failed to load categories");
  return res.json();
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
}
