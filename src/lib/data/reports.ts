"use client";

import { useQuery } from "@tanstack/react-query";
import type { SalesReport } from "@/lib/reports/salesReport";

export type ReportFilters = { from?: string; to?: string; category?: string };

function buildQuery(filters: ReportFilters) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.category) params.set("category", filters.category);
  return params.toString();
}

export function useSalesReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ["salesReport", filters],
    queryFn: async () => {
      const res = await fetch(`/api/reports/sales/data?${buildQuery(filters)}`);
      if (!res.ok) throw new Error("Failed to load report");
      const json = await res.json();
      return {
        ...json,
        from: json.from ? new Date(json.from) : null,
        to: json.to ? new Date(json.to) : null,
        lines: json.lines.map((l: SalesReport["lines"][number]) => ({ ...l, timestamp: new Date(l.timestamp) })),
      } as SalesReport;
    },
  });
}

export function reportDownloadUrl(kind: "pdf" | "csv", filters: ReportFilters, title?: string) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.category) params.set("category", filters.category);
  if (title) params.set("title", title);
  return `/api/reports/sales/${kind}?${params.toString()}`;
}
