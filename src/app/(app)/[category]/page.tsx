"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCategories } from "@/hooks/useCategories";
import { useCards } from "@/lib/data/cards";
import { BulkActionsBar } from "@/components/cards/BulkActionsBar";
import { MarkSoldDialog } from "@/components/cards/MarkSoldDialog";
import { BundleSaleDialog } from "@/components/cards/BundleSaleDialog";
import { CsvImportDialog } from "@/components/cards/CsvImportDialog";
import { FilterPresetsBar } from "@/components/cards/FilterPresetsBar";
import { UsdHint } from "@/components/UsdHint";
import type { CardDTO } from "@/lib/data/types";

const SORT_OPTIONS = [
  { value: "dateAdded", label: "Date added" },
  { value: "askingPrice", label: "Price" },
  { value: "name", label: "Name" },
  { value: "series", label: "Series/Set" },
  { value: "rarity", label: "Rarity" },
  { value: "grade", label: "Condition/Grade" },
  { value: "status", label: "Status" },
];

export default function CategoryInventoryPage() {
  const params = useParams<{ category: string }>();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const { data: categories } = useCategories();
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("dateAdded");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [soldCard, setSoldCard] = useState<CardDTO | null>(null);
  const [bundleCards, setBundleCards] = useState<CardDTO[] | null>(null);
  const [showImport, setShowImport] = useState(false);

  const category = categories?.find((c) => c.key.toLowerCase() === params.category.toLowerCase());
  const isAll = params.category.toLowerCase() === "all";

  const { data: cards, isLoading } = useCards({
    category: isAll ? undefined : category?.key,
    status: status || undefined,
    q: q || undefined,
    sort,
    order,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
  });

  const totalValue = useMemo(
    () => cards?.filter((c) => c.status === "In Stock").reduce((sum, c) => sum + c.askingPrice * c.quantity, 0) ?? 0,
    [cards]
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedCards = cards?.filter((c) => selectedIds.has(c.id)) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{isAll ? "All Categories" : category?.displayName ?? params.category}</h1>
          <p className="text-sm text-foreground/60">
            {cards?.length ?? 0} cards · In-stock value ฿{totalValue.toLocaleString()}
            {q && <> · searching “{q}”</>}
          </p>
        </div>
        <div className="flex gap-2">
          {!isAll && (
            <button
              onClick={() => setShowImport(true)}
              className="booth-target rounded-md border border-border-1 px-3 py-2 text-sm hover:bg-surface-1"
            >
              Bulk import
            </button>
          )}
          <Link
            href={`/${params.category}/new`}
            className="booth-target rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
          >
            Add Card
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-border-1 px-2 py-1.5">
          <option value="">All statuses</option>
          <option>In Stock</option>
          <option>Reserved</option>
          <option>On Hold</option>
          <option>Sold</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-md border border-border-1 px-2 py-1.5">
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
          className="rounded-md border border-border-1 px-2 py-1.5"
        >
          {order === "asc" ? "Ascending" : "Descending"}
        </button>
        <input
          type="number"
          placeholder="Min ฿"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          className="w-24 rounded-md border border-border-1 px-2 py-1.5"
        />
        <input
          type="number"
          placeholder="Max ฿"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          className="w-24 rounded-md border border-border-1 px-2 py-1.5"
        />
      </div>

      <FilterPresetsBar
        category={isAll ? null : category?.key ?? null}
        currentFilters={{ status, sort, order, minPrice, maxPrice }}
        onApply={(f) => {
          setStatus(f.status ?? "");
          setSort(f.sort ?? "dateAdded");
          setOrder(f.order ?? "desc");
          setMinPrice(f.minPrice ?? "");
          setMaxPrice(f.maxPrice ?? "");
        }}
      />

      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        onClear={() => setSelectedIds(new Set())}
        onSellBundle={() => {
          if (selectedCards.length === 1) setSoldCard(selectedCards[0]);
          else setBundleCards(selectedCards);
        }}
      />

      {isLoading && <p className="text-sm text-foreground/60">Loading…</p>}

      <div className="overflow-x-auto rounded-lg border border-border-1">
        <table className="w-full text-sm">
          <thead className="bg-surface-1 text-left text-xs uppercase text-foreground/60">
            <tr>
              <th className="w-8 px-3 py-2"></th>
              {isAll && <th className="px-3 py-2">Category</th>}
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Series/Set</th>
              <th className="px-3 py-2">Rarity</th>
              <th className="px-3 py-2">Grade</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cards?.map((card) => {
              const cardCategory = categories?.find((c) => c.key.toLowerCase() === card.category.toLowerCase());
              return (
                <tr key={card.id} className="border-t border-border-1 hover:bg-surface-1">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selectedIds.has(card.id)} onChange={() => toggleSelect(card.id)} />
                  </td>
                  {isAll && (
                    <td className="px-3 py-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ background: cardCategory?.themeTokens.accent ?? "#64748B" }}
                      >
                        {cardCategory?.displayName ?? card.category}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <Link href={`/${card.category.toLowerCase()}/card/${card.id}`} className="font-medium hover:underline">
                      {card.name}
                    </Link>
                    {card.isHot && <span className="ml-2 text-xs font-medium text-red-600">HOT</span>}
                  </td>
                  <td className="px-3 py-2">{card.series}</td>
                  <td className="px-3 py-2">{card.rarity ?? "—"}</td>
                  <td className="px-3 py-2">{card.grade ?? "—"}</td>
                  <td className="px-3 py-2">
                    ฿{card.askingPrice.toLocaleString()}
                    <UsdHint amountThb={card.askingPrice} />
                    {card.quantity > 1 && <span className="text-foreground/50"> ×{card.quantity}</span>}
                  </td>
                  <td className="px-3 py-2">{card.status}</td>
                  <td className="px-3 py-2 text-right">
                    {card.status !== "Sold" && (
                      <button
                        onClick={() => setSoldCard(card)}
                        className="booth-target rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-dark"
                      >
                        Mark Sold
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {cards?.length === 0 && !isLoading && (
              <tr>
                <td colSpan={isAll ? 8 : 7} className="px-3 py-6 text-center text-foreground/50">
                  No cards match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {soldCard && <MarkSoldDialog card={soldCard} onClose={() => setSoldCard(null)} />}
      {bundleCards && bundleCards.length > 0 && (
        <BundleSaleDialog
          cards={bundleCards}
          onClose={() => {
            setBundleCards(null);
            setSelectedIds(new Set());
          }}
        />
      )}
      {showImport && category && <CsvImportDialog category={category} onClose={() => setShowImport(false)} />}
    </div>
  );
}
