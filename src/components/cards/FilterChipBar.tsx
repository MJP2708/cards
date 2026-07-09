"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ListFilter, X, ArrowDownWideNarrow, ArrowUpWideNarrow } from "lucide-react";
import { STATUS_VALUES, useStatusLabel } from "@/lib/statusLabels";

export type ChipFilters = {
  status: string;
  minPrice: string;
  maxPrice: string;
};

export function FilterChipBar({
  filters,
  onChangeFilters,
  sort,
  order,
  onChangeSort,
  onChangeOrder,
}: {
  filters: ChipFilters;
  onChangeFilters: (next: ChipFilters) => void;
  sort: string;
  order: "asc" | "desc";
  onChangeSort: (value: string) => void;
  onChangeOrder: (value: "asc" | "desc") => void;
}) {
  const t = useTranslations("inventory");
  const statusLabel = useStatusLabel();
  const [open, setOpen] = useState(false);

  const SORT_OPTIONS = [
    { value: "dateAdded", label: t("sortDateAdded") },
    { value: "askingPrice", label: t("sortPrice") },
    { value: "name", label: t("sortName") },
    { value: "series", label: t("sortSeries") },
    { value: "rarity", label: t("sortRarity") },
    { value: "grade", label: t("sortGrade") },
    { value: "status", label: t("sortStatus") },
  ];

  const chips: { key: keyof ChipFilters; label: string }[] = [];
  if (filters.status) chips.push({ key: "status", label: statusLabel(filters.status) });
  if (filters.minPrice) chips.push({ key: "minPrice", label: t("chipMin", { amount: filters.minPrice }) });
  if (filters.maxPrice) chips.push({ key: "maxPrice", label: t("chipMax", { amount: filters.maxPrice }) });

  function removeChip(key: keyof ChipFilters) {
    onChangeFilters({ ...filters, [key]: "" });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="booth-target flex items-center gap-1.5 rounded-md border border-border-1 px-2.5 py-1.5 hover:bg-surface-1"
        >
          <ListFilter className="h-3.5 w-3.5" aria-hidden />
          {t("filter")}
        </button>
        {open && (
          <div className="absolute left-0 top-full z-20 mt-1 w-64 space-y-3 rounded-md border border-border-1 bg-background p-3 shadow-lg">
            <label className="flex flex-col gap-1 text-xs">
              {t("status")}
              <select
                value={filters.status}
                onChange={(e) => onChangeFilters({ ...filters, status: e.target.value })}
                className="rounded-md border border-border-1 px-2 py-1.5"
              >
                <option value="">{t("any")}</option>
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1 text-xs">
                {t("minPrice")}
                <input
                  type="number"
                  value={filters.minPrice}
                  onChange={(e) => onChangeFilters({ ...filters, minPrice: e.target.value })}
                  className="rounded-md border border-border-1 px-2 py-1.5"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-xs">
                {t("maxPrice")}
                <input
                  type="number"
                  value={filters.maxPrice}
                  onChange={(e) => onChangeFilters({ ...filters, maxPrice: e.target.value })}
                  className="rounded-md border border-border-1 px-2 py-1.5"
                />
              </label>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-full rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-dark"
            >
              {t("done")}
            </button>
          </div>
        )}
      </div>

      {chips.map((chip) => (
        <span
          key={chip.key}
          className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface-1))] px-2.5 py-1 text-xs font-medium"
          style={{ color: "var(--accent-dark)" }}
        >
          {chip.label}
          <button onClick={() => removeChip(chip.key)} aria-label={t("removeFilter", { label: chip.label })}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      <div className="ml-auto flex items-center gap-1.5">
        <select
          value={sort}
          onChange={(e) => onChangeSort(e.target.value)}
          className="rounded-md border border-border-1 px-2 py-1.5 text-sm"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => onChangeOrder(order === "asc" ? "desc" : "asc")}
          aria-label={order === "asc" ? t("ascending") : t("descending")}
          className="rounded-md border border-border-1 p-1.5 hover:bg-surface-1"
        >
          {order === "asc" ? <ArrowUpWideNarrow className="h-4 w-4" /> : <ArrowDownWideNarrow className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
