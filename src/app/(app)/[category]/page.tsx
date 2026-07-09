"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { PackagePlus, Upload, Inbox, SearchX, LayoutGrid, Rows3, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCategories } from "@/hooks/useCategories";
import { useCards } from "@/lib/data/cards";
import { useLongPress } from "@/hooks/useLongPress";
import { BulkActionsBar } from "@/components/cards/BulkActionsBar";
import { MarkSoldDialog } from "@/components/cards/MarkSoldDialog";
import { BundleSaleDialog } from "@/components/cards/BundleSaleDialog";
import { CsvImportDialog } from "@/components/cards/CsvImportDialog";
import { FilterChipBar, type ChipFilters } from "@/components/cards/FilterChipBar";
import { StatusPill } from "@/components/ui/StatusPill";
import { Price } from "@/components/ui/Price";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardRowSkeleton } from "@/components/ui/Skeleton";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { CardThumbnail } from "@/components/cards/CardThumbnail";
import { CardGrid } from "@/components/cards/CardGrid";
import { PhotoLightbox } from "@/components/cards/PhotoLightbox";
import { useUiStore } from "@/store/uiStore";
import { motionProfileFor } from "@/lib/motionProfiles";
import type { CardDTO } from "@/lib/data/types";
import type { CategoryDTO } from "@/lib/categories";

function InventoryRow({
  card,
  cardCategory,
  isAll,
  isSelected,
  selectionActive,
  onToggleSelect,
  onMarkSold,
  onViewPhoto,
}: {
  card: CardDTO;
  cardCategory: CategoryDTO | undefined;
  isAll: boolean;
  isSelected: boolean;
  selectionActive: boolean;
  onToggleSelect: (id: string) => void;
  onMarkSold: (card: CardDTO) => void;
  onViewPhoto: (card: CardDTO) => void;
}) {
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const { pressing, handlers } = useLongPress(() => onToggleSelect(card.id));

  return (
    <tr
      {...handlers}
      className={`border-t border-border-1 transition-colors hover:bg-surface-1 ${isSelected ? "bg-[var(--accent-tint-weak)]" : ""} ${pressing ? "bg-surface-1" : ""}`}
    >
      <td className="px-1 py-2">
        <button
          onClick={() => onToggleSelect(card.id)}
          aria-pressed={isSelected}
          aria-label={t("selectCard", { name: card.name })}
          className="tap-compact flex h-11 w-8 items-center justify-center"
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
              isSelected ? "border-accent bg-accent" : "border-border-1"
            }`}
          >
            {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
          </span>
        </button>
      </td>
      <td className="px-1 py-2">
        <CardThumbnail
          photoFront={card.photoFront}
          name={card.name}
          themeTokens={cardCategory?.themeTokens}
          size="md"
          onClick={() => onViewPhoto(card)}
        />
      </td>
      {isAll && (
        <td className="hidden px-3 py-2 sm:table-cell">
          <span
            className="flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
            style={{
              background: cardCategory ? "var(--accent-tint-strong)" : "var(--surface-1)",
              borderColor: cardCategory ? "var(--accent-tint-border)" : "var(--border-1)",
              color: cardCategory?.themeTokens.accentDark ?? cardCategory?.themeTokens.accent ?? "#334155",
            }}
          >
            <CategoryIcon iconSet={cardCategory?.themeTokens.iconSet ?? "neutral"} className="h-3 w-3" />
            {cardCategory?.displayName ?? card.category}
          </span>
        </td>
      )}
      <td className="px-3 py-2">
        <Link
          href={selectionActive ? "#" : `/${card.category.toLowerCase()}/card/${card.id}`}
          onClick={(e) => {
            if (selectionActive) {
              e.preventDefault();
              onToggleSelect(card.id);
            }
          }}
          className="font-medium hover:underline"
        >
          {card.name}
        </Link>
        {card.isHot && (
          <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
            {t("hotBadge")}
          </span>
        )}
        {/* Series + status ride along under the name below `md`, since those columns hide there. */}
        <div className="flex items-center gap-1.5 md:hidden">
          <p className="truncate text-xs text-foreground/50">{card.series}</p>
          <StatusPill status={card.status} className="sm:hidden" />
        </div>
      </td>
      <td className="hidden px-3 py-2 md:table-cell">{card.series}</td>
      <td className="hidden px-3 py-2 lg:table-cell">{card.rarity ?? "—"}</td>
      <td className="hidden px-3 py-2 lg:table-cell">{card.grade ?? "—"}</td>
      <td className="px-3 py-2">
        <Price amountThb={card.askingPrice} size="sm" showUsd />
        {card.quantity > 1 && <span className="text-foreground/50"> ×{card.quantity}</span>}
      </td>
      <td className="hidden px-3 py-2 sm:table-cell">
        <StatusPill status={card.status} />
      </td>
      <td className="px-3 py-2 text-right">
        {card.status !== "Sold" && (
          <button
            onClick={() => onMarkSold(card)}
            className="booth-target rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-dark"
          >
            {common("markSold")}
          </button>
        )}
      </td>
    </tr>
  );
}

export default function CategoryInventoryPage() {
  const params = useParams<{ category: string }>();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const { data: categories } = useCategories();
  const [filters, setFilters] = useState<ChipFilters>({ status: "", minPrice: "", maxPrice: "" });
  const [sort, setSort] = useState("dateAdded");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [soldCard, setSoldCard] = useState<CardDTO | null>(null);
  const [bundleCards, setBundleCards] = useState<CardDTO[] | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [photoCard, setPhotoCard] = useState<CardDTO | null>(null);
  const listViewMode = useUiStore((s) => s.listViewMode);
  const setListViewMode = useUiStore((s) => s.setListViewMode);

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
  const selectionActive = selectedIds.size > 0;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={params.category}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: motionProfileFor(category?.themeTokens.motif).crossfadeSeconds }}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-display-md font-display font-semibold">
              <CategoryIcon iconSet={category?.themeTokens.iconSet ?? "neutral"} className="h-6 w-6" style={{ color: "var(--accent)" }} />
              {isAll ? common("allCategories") : category?.displayName ?? params.category}
            </h1>
            <p className="text-sm text-foreground/60">
              {t("cardsCount", { count: cards?.length ?? 0 })} · {t("inStockValue")} ฿{totalValue.toLocaleString()}
              {q && <> · {t("searching", { query: q })}</>}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex rounded-md border border-border-1 p-0.5">
              <button
                onClick={() => setListViewMode("table")}
                aria-label={t("tableView")}
                aria-pressed={listViewMode === "table"}
                className={`tap-compact rounded px-2 py-1.5 ${listViewMode === "table" ? "bg-accent text-white" : "text-foreground/50 hover:bg-surface-1"}`}
              >
                <Rows3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setListViewMode("grid")}
                aria-label={t("gridView")}
                aria-pressed={listViewMode === "grid"}
                className={`tap-compact rounded px-2 py-1.5 ${listViewMode === "grid" ? "bg-accent text-white" : "text-foreground/50 hover:bg-surface-1"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
            {!isAll && (
              <button
                onClick={() => setShowImport(true)}
                className="booth-target hidden items-center gap-1.5 rounded-md border border-border-1 px-3 py-2 text-sm hover:bg-surface-1 sm:flex"
              >
                <Upload className="h-4 w-4" aria-hidden />
                {t("bulkImport")}
              </button>
            )}
            <Link
              href={`/${params.category}/new`}
              className="booth-target hidden items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark sm:flex"
            >
              <PackagePlus className="h-4 w-4" aria-hidden />
              {common("addCard")}
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
          category={isAll ? null : category?.key ?? null}
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
            title={
              hasActiveFilters
                ? t("emptyFilteredTitle")
                : isAll
                  ? t("emptyAllTitle")
                  : t("emptyCategoryTitle", { category: category?.displayName ?? params.category })
            }
            description={hasActiveFilters ? t("emptyFilteredDescription") : t("emptyDescription")}
            actionLabel={hasActiveFilters ? undefined : common("addCard")}
            actionHref={hasActiveFilters ? undefined : `/${params.category}/new`}
          />
        )}

        {!isLoading && (cards?.length ?? 0) > 0 && listViewMode === "grid" && (
          <CardGrid
            cards={cards ?? []}
            categories={categories}
            isAll={isAll}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onMarkSold={setSoldCard}
            onViewPhoto={setPhotoCard}
          />
        )}

        {!isLoading && (cards?.length ?? 0) > 0 && listViewMode === "table" && (
          <div className="overflow-x-auto rounded-lg border border-border-1">
            <table className="w-full text-sm">
              <thead className="bg-surface-1 text-left text-xs uppercase text-foreground/60">
                <tr>
                  <th className="w-8 px-1 py-2"></th>
                  <th className="w-16 px-1 py-2"></th>
                  {isAll && <th className="hidden px-3 py-2 sm:table-cell">{t("colCategory")}</th>}
                  <th className="px-3 py-2">{t("colName")}</th>
                  <th className="hidden px-3 py-2 md:table-cell">{t("colSeriesSet")}</th>
                  <th className="hidden px-3 py-2 lg:table-cell">{t("colRarity")}</th>
                  <th className="hidden px-3 py-2 lg:table-cell">{t("colGrade")}</th>
                  <th className="px-3 py-2">{t("colPrice")}</th>
                  <th className="hidden px-3 py-2 sm:table-cell">{t("colStatus")}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {cards?.map((card) => (
                  <InventoryRow
                    key={card.id}
                    card={card}
                    cardCategory={categories?.find((c) => c.key.toLowerCase() === card.category.toLowerCase())}
                    isAll={isAll}
                    isSelected={selectedIds.has(card.id)}
                    selectionActive={selectionActive}
                    onToggleSelect={toggleSelect}
                    onMarkSold={setSoldCard}
                    onViewPhoto={setPhotoCard}
                  />
                ))}
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
        {photoCard && (
          <PhotoLightbox
            name={photoCard.name}
            photoFront={photoCard.photoFront}
            photoBack={photoCard.photoBack}
            onClose={() => setPhotoCard(null)}
          />
        )}

        {/* Mobile-only: the header's Add Card link scrolls away with the page,
            so the single most common action gets a thumb-reachable anchor
            that never does. Hidden once a bulk selection is active so it
            doesn't collide with the sticky selection bar above it. */}
        {!selectionActive && (
          <Link
            href={`/${params.category}/new`}
            aria-label={common("addCard")}
            className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[var(--shadow-md)] hover:bg-accent-dark md:hidden"
          >
            <Plus className="h-6 w-6" />
          </Link>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
