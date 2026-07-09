"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CardThumbnail } from "@/components/cards/CardThumbnail";
import { StatusPill } from "@/components/ui/StatusPill";
import { Price } from "@/components/ui/Price";
import { SwipeableRow } from "@/components/cards/SwipeableRow";
import type { CardDTO } from "@/lib/data/types";
import type { CategoryDTO } from "@/lib/categories";

export function CardGrid({
  cards,
  categories,
  isAll,
  selectedIds,
  onToggleSelect,
  onMarkSold,
  onViewPhoto,
}: {
  cards: CardDTO[];
  categories: CategoryDTO[] | undefined;
  isAll: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onMarkSold: (card: CardDTO) => void;
  onViewPhoto: (card: CardDTO) => void;
}) {
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const selectionActive = selectedIds.size > 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {cards.map((card) => {
        const cardCategory = categories?.find((c) => c.key.toLowerCase() === card.category.toLowerCase());
        const isSold = card.status === "Sold";
        const isSelected = selectedIds.has(card.id);
        return (
          <SwipeableRow
            key={card.id}
            disabled={isSold}
            onSwipeSell={() => onMarkSold(card)}
            onSwipeSelect={() => onToggleSelect(card.id)}
            onLongPress={() => onToggleSelect(card.id)}
            className="rounded-lg border border-border-1"
          >
            <div className={`flex flex-col overflow-hidden rounded-lg ${isSelected ? "ring-2 ring-accent" : ""}`}>
              <div className="relative">
                <CardThumbnail
                  photoFront={card.photoFront}
                  name={card.name}
                  themeTokens={cardCategory?.themeTokens}
                  size="lg"
                  onClick={() => onViewPhoto(card)}
                />
                <button
                  onClick={() => onToggleSelect(card.id)}
                  aria-pressed={isSelected}
                  aria-label={t("selectCard", { name: card.name })}
                  className="tap-compact absolute left-1 top-1 flex h-9 w-9 items-center justify-center"
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 shadow-sm ${
                      isSelected ? "border-accent bg-accent" : "border-white bg-white/80 backdrop-blur"
                    }`}
                  >
                    {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                </button>
                {card.isHot && (
                  <span className="absolute right-2 top-2 rounded-full bg-red-600 px-1.5 py-0.5 text-[0.65rem] font-medium text-white">
                    {t("hotBadge")}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                {isAll && cardCategory && (
                  <span className="text-[0.65rem] font-medium uppercase" style={{ color: cardCategory.themeTokens.accentDark ?? cardCategory.themeTokens.accent }}>
                    {cardCategory.displayName}
                  </span>
                )}
                <Link
                  href={selectionActive ? "#" : `/${card.category.toLowerCase()}/card/${card.id}`}
                  onClick={(e) => {
                    if (selectionActive) {
                      e.preventDefault();
                      onToggleSelect(card.id);
                    }
                  }}
                  className="text-sm font-medium leading-tight hover:underline"
                >
                  {card.name}
                </Link>
                <p className="truncate text-xs text-foreground/50">{card.series}</p>
                <div className="mt-auto flex items-center justify-between gap-1">
                  <Price amountThb={card.askingPrice} size="sm" />
                  <StatusPill status={card.status} className="hidden sm:inline-flex" />
                </div>
                {!isSold ? (
                  <button
                    onClick={() => onMarkSold(card)}
                    className="booth-target mt-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent-dark"
                  >
                    {common("markSold")}
                  </button>
                ) : (
                  <span className="mt-1 rounded-md bg-surface-1 px-2 py-1 text-center text-xs text-foreground/50">{common("sold")}</span>
                )}
              </div>
            </div>
          </SwipeableRow>
        );
      })}
    </div>
  );
}
