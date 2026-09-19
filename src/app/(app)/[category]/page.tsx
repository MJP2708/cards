"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { PackagePlus, Upload, Inbox, SearchX, LayoutGrid, Rows3, Plus, CircleDollarSign, ShieldCheck, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCategories } from "@/hooks/useCategories";
import { useCards, useVerifyAll } from "@/lib/data/cards";
import { useLongPress } from "@/hooks/useLongPress";
import { BulkActionsBar } from "@/components/cards/BulkActionsBar";
import { MarkSoldDialog } from "@/components/cards/MarkSoldDialog";
import { BundleSaleDialog } from "@/components/cards/BundleSaleDialog";
import { CsvImportDialog } from "@/components/cards/CsvImportDialog";
import { FilterChipBar, type ChipFilters } from "@/components/cards/FilterChipBar";
import { StatusPill } from "@/components/ui/StatusPill";
import { Price } from "@/components/ui/Price";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardRowSkeleton } from "@/components/ui/Skeleton";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { CardThumbnail } from "@/components/cards/CardThumbnail";
import { CardGrid } from "@/components/cards/CardGrid";
import { VerificationBadge } from "@/components/cards/VerificationBadge";
import { LookupBadge } from "@/components/cards/LookupBadge";
import { LookupJump } from "@/components/cards/LookupJump";
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
          /* 40px rather than 64px: in a dense row the thumbnail is an at-a-glance
             cue, not the subject, and the 24px it gives back is the difference
             between "Victor We…" and a readable card name on a phone. The grid
             view is where the full-size image lives. */
          size="sm"
          onClick={() => onViewPhoto(card)}
          isStock={card.photoIsStock}
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
      {/* `w-full max-w-0` is the table-cell truncation idiom: the cell claims the
          leftover width but refuses to grow to fit its content, so long card names
          ellipsize rather than widening the row past the viewport. */}
      <td className="w-full max-w-0 px-3 py-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <LookupBadge lookupNumber={card.lookupNumber} />
          <Link
            href={selectionActive ? "#" : `/${card.category.toLowerCase()}/card/${card.id}`}
            onClick={(e) => {
              if (selectionActive) {
                e.preventDefault();
                onToggleSelect(card.id);
              }
            }}
            className="tap-compact block truncate font-medium hover:underline"
          >
            {card.name}
          </Link>
        </span>
        {card.isHot && (
          <Badge tone="danger" className="ml-2">
            {t("hotBadge")}
          </Badge>
        )}
        {/* Inline with the name rather than in its own column: the point is to see
            a problem without opening the card, and a column that hides below `lg`
            would be invisible on exactly the phone the booth runs on. */}
        <VerificationBadge
          status={card.verificationStatus}
          notes={card.verificationNotes}
          className="ml-1.5 align-middle"
        />
        {/* Series + status ride along under the name below `md`, since those columns hide there. */}
        <div className="flex min-w-0 items-center gap-1.5 md:hidden">
          <p className="hidden min-w-0 truncate text-xs text-foreground/50 sm:block">{card.series}</p>
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
          /* Icon-only on phones. The Thai label is long enough that the text
             button pushed this column past the viewport, so the shop's most-used
             action sat off-screen behind a horizontal scroll. */
          <Button
            size="sm"
            onClick={() => onMarkSold(card)}
            aria-label={common("markSold")}
            icon={CircleDollarSign}
            className="min-h-11 min-w-11 whitespace-nowrap sm:min-h-0 sm:min-w-0"
          >
            <span className="hidden sm:inline">{common("markSold")}</span>
          </Button>
        )}
      </td>
    </tr>
  );
}

export default function CategoryInventoryPage() {
  const params = useParams<{ category: string }>();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  // Seeded from the URL so the import summary can link straight to the problem
  // cards ("/all?verification=flagged") instead of telling the user where to click.
  const verificationParam = searchParams.get("verification") ?? "";
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const v = useTranslations("verification");
  const { data: categories } = useCategories();
  const [filters, setFilters] = useState<ChipFilters>({
    status: "",
    minPrice: "",
    maxPrice: "",
    verification: verificationParam,
  });
  const [sort, setSort] = useState("dateAdded");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [soldCard, setSoldCard] = useState<CardDTO | null>(null);
  const [bundleCards, setBundleCards] = useState<CardDTO[] | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [photoCard, setPhotoCard] = useState<CardDTO | null>(null);
  const verifyAll = useVerifyAll();
  const [verifySummary, setVerifySummary] = useState<string | null>(null);
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
    verification: filters.verification || undefined,
  });

  const totalValue = useMemo(
    () => cards?.filter((c) => c.status === "In Stock").reduce((sum, c) => sum + c.askingPrice * c.quantity, 0) ?? 0,
    [cards]
  );

  const hasActiveFilters = !!(filters.status || filters.minPrice || filters.maxPrice || filters.verification || q);

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
            <LookupJump />
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
            <button
              onClick={async () => {
                setVerifySummary(null);
                const result = await verifyAll.mutateAsync(isAll ? {} : { category: category?.key });
                setVerifySummary(
                  v("reverifyAllResult", {
                    checked: result.checked,
                    verified: result.verified,
                    flagged: result.flagged,
                  })
                );
              }}
              disabled={verifyAll.isPending}
              title={v("reverifyAllHelp")}
              className="hidden items-center gap-1.5 rounded-md border border-border-1 px-3 py-2 text-sm hover:bg-surface-1 disabled:opacity-50 sm:flex"
            >
              <ShieldCheck className={`h-4 w-4 ${verifyAll.isPending ? "animate-pulse" : ""}`} aria-hidden />
              {verifyAll.isPending ? v("reverifying") : v("reverifyAll")}
            </button>
            {!isAll && (
              <button
                onClick={() => setShowImport(true)}
                className="hidden items-center gap-1.5 rounded-md border border-border-1 px-3 py-2 text-sm hover:bg-surface-1 sm:flex"
              >
                <Upload className="h-4 w-4" aria-hidden />
                {t("bulkImport")}
              </button>
            )}
            <a
              href={`/api/cards/export${isAll ? "" : `?category=${encodeURIComponent(category?.key ?? "")}`}`}
              className="hidden items-center gap-1.5 rounded-md border border-border-1 px-3 py-2 text-sm hover:bg-surface-1 sm:flex"
            >
              <Download className="h-4 w-4" aria-hidden />
              {t("exportCsv")}
            </a>
            <Link
              href={`/${params.category}/new`}
              className="hidden items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark sm:flex"
            >
              <PackagePlus className="h-4 w-4" aria-hidden />
              {common("addCard")}
            </Link>
          </div>
        </div>

        {verifySummary && (
          <p className="rounded-md border border-border-1 bg-surface-1 px-3 py-2 text-sm">{verifySummary}</p>
        )}

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
                  <th className="w-12 px-1 py-2"></th>
                  {isAll && <th className="hidden px-3 py-2 sm:table-cell">{t("colCategory")}</th>}
                  <th className="w-full max-w-0 px-3 py-2">{t("colName")}</th>
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
            isStock={photoCard.photoIsStock}
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
