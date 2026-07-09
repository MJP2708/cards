"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ListFilter, X, ArrowDownWideNarrow, ArrowUpWideNarrow, Bookmark, Plus } from "lucide-react";
import { STATUS_VALUES, useStatusLabel } from "@/lib/statusLabels";
import { useClickOutside } from "@/hooks/useClickOutside";
import {
  useFilterPresets,
  useCreateFilterPreset,
  useDeleteFilterPreset,
  type FilterPresetValues,
} from "@/lib/data/filterPresets";

export type ChipFilters = {
  status: string;
  minPrice: string;
  maxPrice: string;
};

// One filter system, not three: status/price live filters, sort, and saved
// presets used to be three separately-styled UI regions stacked on the page.
// They're now one row — "find my cards" is a single mental task for a dealer,
// so it's a single control.
export function FilterChipBar({
  filters,
  onChangeFilters,
  sort,
  order,
  onChangeSort,
  onChangeOrder,
  category,
}: {
  filters: ChipFilters;
  onChangeFilters: (next: ChipFilters) => void;
  sort: string;
  order: "asc" | "desc";
  onChangeSort: (value: string) => void;
  onChangeOrder: (value: "asc" | "desc") => void;
  category: string | null;
}) {
  const t = useTranslations("inventory");
  const statusLabel = useStatusLabel();
  const [open, setOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const filterRef = useClickOutside<HTMLDivElement>(() => setOpen(false), open);
  const presetsRef = useClickOutside<HTMLDivElement>(() => {
    setPresetsOpen(false);
    setNaming(false);
  }, presetsOpen);

  const { data: presets } = useFilterPresets(category ?? undefined);
  const createPreset = useCreateFilterPreset();
  const deletePreset = useDeleteFilterPreset();

  const currentFilters: FilterPresetValues = { status: filters.status, sort, order, minPrice: filters.minPrice, maxPrice: filters.maxPrice };

  function applyPreset(f: FilterPresetValues) {
    onChangeFilters({ status: f.status ?? "", minPrice: f.minPrice ?? "", maxPrice: f.maxPrice ?? "" });
    onChangeSort(f.sort ?? "dateAdded");
    onChangeOrder(f.order ?? "desc");
    setPresetsOpen(false);
  }

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
  const hasActiveFilters = chips.length > 0;

  function removeChip(key: keyof ChipFilters) {
    onChangeFilters({ ...filters, [key]: "" });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <div className="relative" ref={filterRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="tap-compact flex items-center gap-1.5 rounded-md border border-border-1 px-2.5 py-1.5 hover:bg-surface-1"
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
          className="flex items-center gap-1 rounded-full bg-[var(--accent-tint-strong)] px-2.5 py-1 text-xs font-medium"
          style={{ color: "var(--accent-dark)" }}
        >
          {chip.label}
          <button onClick={() => removeChip(chip.key)} aria-label={t("removeFilter", { label: chip.label })} className="tap-compact">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      <div className="relative" ref={presetsRef}>
        <button
          onClick={() => setPresetsOpen((o) => !o)}
          aria-expanded={presetsOpen}
          className="tap-compact flex items-center gap-1.5 rounded-md border border-dashed border-border-1 px-2.5 py-1.5 text-foreground/60 hover:bg-surface-1"
        >
          <Bookmark className="h-3.5 w-3.5" aria-hidden />
          {t("savedFilters")}
        </button>
        {presetsOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-60 space-y-2 rounded-md border border-border-1 bg-background p-2.5 shadow-lg">
            {presets && presets.length > 0 ? (
              <ul className="space-y-1">
                {presets.map((preset) => (
                  <li key={preset.id} className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-surface-1">
                    <button onClick={() => applyPreset(preset.filterJson)} className="flex-1 truncate text-left text-xs">
                      {preset.name}
                    </button>
                    <button
                      onClick={() => deletePreset.mutate(preset.id)}
                      aria-label={t("deletePreset", { name: preset.name })}
                      className="tap-compact text-foreground/40 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1.5 py-1 text-xs text-foreground/50">{t("noSavedFilters")}</p>
            )}
            {hasActiveFilters &&
              (!naming ? (
                <button
                  onClick={() => setNaming(true)}
                  className="flex w-full items-center justify-center gap-1 rounded-md border-t border-border-1 pt-2 text-xs text-accent hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  {t("savePreset")}
                </button>
              ) : (
                <div className="flex items-center gap-1 border-t border-border-1 pt-2">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("presetName")}
                    className="min-w-0 flex-1 rounded-md border border-border-1 px-2 py-1 text-xs"
                  />
                  <button
                    onClick={async () => {
                      if (!name.trim()) return;
                      await createPreset.mutateAsync({ name: name.trim(), category, filterJson: currentFilters });
                      setName("");
                      setNaming(false);
                    }}
                    className="rounded-md bg-accent px-2 py-1 text-xs text-white"
                  >
                    {t("done")}
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <select
          value={sort}
          onChange={(e) => onChangeSort(e.target.value)}
          className="tap-compact rounded-md border border-border-1 px-2 py-1.5 text-sm"
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
          className="tap-compact rounded-md border border-border-1 p-1.5 hover:bg-surface-1"
        >
          {order === "asc" ? <ArrowUpWideNarrow className="h-4 w-4" /> : <ArrowDownWideNarrow className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
