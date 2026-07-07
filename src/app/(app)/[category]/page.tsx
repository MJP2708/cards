"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { PackagePlus, Upload, Inbox, SearchX } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useCards } from "@/lib/data/cards";
import { BulkActionsBar } from "@/components/cards/BulkActionsBar";
import { MarkSoldDialog } from "@/components/cards/MarkSoldDialog";
import { BundleSaleDialog } from "@/components/cards/BundleSaleDialog";
import { CsvImportDialog } from "@/components/cards/CsvImportDialog";
import { FilterPresetsBar } from "@/components/cards/FilterPresetsBar";
import { FilterChipBar, type ChipFilters } from "@/components/cards/FilterChipBar";
import { UsdHint } from "@/components/UsdHint";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardRowSkeleton } from "@/components/ui/Skeleton";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import type { CardDTO } from "@/lib/data/types";

export default function CategoryInventoryPage() {
  const params = useParams<{ category: string }>();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const { data: categories } = useCategories();
  const [filters, setFilters] = useState<ChipFilters>({ status: "", minPrice: "", maxPrice: "" });
  const [sort, setSort] = useState("dateAdded");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [soldCard, setSoldCard] = useState<CardDTO | null>(null);
  const [bundleCards, setBundleCards] = useState<CardDTO[] | null>(null);
  const [showImport, setShowImport] = useState(false);

  const category = categories?.find((c) => c.key.toLowerCase() === params.category.toLowerCase());
  const isAll = params.category.toLowerCase() === "all";

  const { data: cards, isLoading } = useCards({
    category: isAll ? undefined : category?.key,
    status: filters.status || undefined,
    q: q || undefined,
    sort,
    order,
    minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
    maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
  });

  const totalValue = useMemo(
    () => cards?.filter((c) => c.status === "In Stock").reduce((sum, c) => sum + c.askingPrice * c.quantity, 0) ?? 0,
    [cards]
  );

  const hasActiveFilters = !!(filters.status || filters.minPrice || filters.maxPrice || q);

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
    <AnimatePresence mode="wait">
      <motion.div
        key={params.category}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-display-md font-display font-semibold">
              <CategoryIcon iconSet={category?.themeTokens.iconSet ?? "neutral"} className="h-6 w-6" style={{ color: "var(--accent)" }} />
              {isAll ? "All Categories" : category?.displayName ?? params.category}
            </h1>
            <p className="text-sm text-foreground/60">
              {cards?.length ?? 0} cards · In-stock value ฿{totalValue.toLocaleString()}
              {q && <> · searching “{q}”</>}
            </p>
          </div>
          <div className="flex gap-2">
            {!isAll && (
              <button
                onClick={() => setShowImport(true)}
                className="booth-target flex items-center gap-1.5 rounded-md border border-border-1 px-3 py-2 text-sm hover:bg-surface-1"
              >
                <Upload className="h-4 w-4" aria-hidden />
                Bulk import
              </button>
            )}
            <Link
              href={`/${params.category}/new`}
              className="booth-target flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
            >
              <PackagePlus className="h-4 w-4" aria-hidden />
              Add Card
            </Link>
          </div>
        </div>

        <FilterChipBar
          filters={filters}
          onChangeFilters={setFilters}
          sort={sort}
          order={order}
          onChangeSort={setSort}
          onChangeOrder={setOrder}
        />

        <FilterPresetsBar
          category={isAll ? null : category?.key ?? null}
          currentFilters={{ status: filters.status, sort, order, minPrice: filters.minPrice, maxPrice: filters.maxPrice }}
          onApply={(f) => {
            setFilters({ status: f.status ?? "", minPrice: f.minPrice ?? "", maxPrice: f.maxPrice ?? "" });
            setSort(f.sort ?? "dateAdded");
            setOrder(f.order ?? "desc");
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

        {isLoading && (
          <div className="overflow-hidden rounded-lg border border-border-1">
            {[...Array(5)].map((_, i) => (
              <CardRowSkeleton key={i} />
            ))}
          </div>
        )}

        {!isLoading && cards?.length === 0 && (
          <EmptyState
            icon={hasActiveFilters ? SearchX : Inbox}
            title={hasActiveFilters ? "No cards match these filters" : `No ${isAll ? "" : category?.displayName + " "}cards yet`}
            description={
              hasActiveFilters
                ? "Try clearing a filter or the search bar to widen the results."
                : "Add your first card to start tracking inventory for this category."
            }
            actionLabel={hasActiveFilters ? undefined : "Add Card"}
            actionHref={hasActiveFilters ? undefined : `/${params.category}/new`}
          />
        )}

        {!isLoading && (cards?.length ?? 0) > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border-1">
            <table className="w-full text-sm">
              <thead className="bg-surface-1 text-left text-xs uppercase text-foreground/60">
                <tr>
                  <th className="w-8 px-3 py-2"></th>
                  {isAll && <th className="hidden px-3 py-2 sm:table-cell">Category</th>}
                  <th className="px-3 py-2">Name</th>
                  <th className="hidden px-3 py-2 md:table-cell">Series/Set</th>
                  <th className="hidden px-3 py-2 lg:table-cell">Rarity</th>
                  <th className="hidden px-3 py-2 lg:table-cell">Grade</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="hidden px-3 py-2 sm:table-cell">Status</th>
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
                        <td className="hidden px-3 py-2 sm:table-cell">
                          <span
                            className="flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                            style={{
                              background: `color-mix(in srgb, ${cardCategory?.themeTokens.accent ?? "#64748B"} 14%, var(--surface-1))`,
                              borderColor: `color-mix(in srgb, ${cardCategory?.themeTokens.accent ?? "#64748B"} 35%, var(--border-1))`,
                              color: cardCategory?.themeTokens.accentDark ?? cardCategory?.themeTokens.accent ?? "#334155",
                            }}
                          >
                            <CategoryIcon iconSet={cardCategory?.themeTokens.iconSet ?? "neutral"} className="h-3 w-3" />
                            {cardCategory?.displayName ?? card.category}
                          </span>
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <Link href={`/${card.category.toLowerCase()}/card/${card.id}`} className="font-medium hover:underline">
                          {card.name}
                        </Link>
                        {card.isHot && (
                          <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                            HOT
                          </span>
                        )}
                        {/* Series + status ride along under the name below `md`, since those columns hide there. */}
                        <p className="text-xs text-foreground/50 md:hidden">
                          {card.series}
                          <span className="sm:hidden"> · {card.status}</span>
                        </p>
                      </td>
                      <td className="hidden px-3 py-2 md:table-cell">{card.series}</td>
                      <td className="hidden px-3 py-2 lg:table-cell">{card.rarity ?? "—"}</td>
                      <td className="hidden px-3 py-2 lg:table-cell">{card.grade ?? "—"}</td>
                      <td className="px-3 py-2">
                        ฿{card.askingPrice.toLocaleString()}
                        <UsdHint amountThb={card.askingPrice} />
                        {card.quantity > 1 && <span className="text-foreground/50"> ×{card.quantity}</span>}
                      </td>
                      <td className="hidden px-3 py-2 sm:table-cell">{card.status}</td>
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
              </tbody>
            </table>
          </div>
        )}

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
      </motion.div>
    </AnimatePresence>
  );
}
