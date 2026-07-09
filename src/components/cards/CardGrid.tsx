"use client";

import Link from "next/link";
import { CardThumbnail } from "@/components/cards/CardThumbnail";
import { UsdHint } from "@/components/UsdHint";
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
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {cards.map((card) => {
        const cardCategory = categories?.find((c) => c.key.toLowerCase() === card.category.toLowerCase());
        return (
          <div key={card.id} className="flex flex-col overflow-hidden rounded-lg border border-border-1">
            <div className="relative">
              <CardThumbnail
                photoFront={card.photoFront}
                name={card.name}
                themeTokens={cardCategory?.themeTokens}
                size="lg"
                onClick={() => onViewPhoto(card)}
              />
              <input
                type="checkbox"
                checked={selectedIds.has(card.id)}
                onChange={() => onToggleSelect(card.id)}
                className="absolute left-2 top-2 h-4 w-4"
                aria-label={`Select ${card.name}`}
              />
              {card.isHot && (
                <span className="absolute right-2 top-2 rounded-full bg-red-600 px-1.5 py-0.5 text-[0.65rem] font-medium text-white">
                  HOT
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-2.5">
              {isAll && cardCategory && (
                <span className="text-[0.65rem] font-medium uppercase" style={{ color: cardCategory.themeTokens.accentDark ?? cardCategory.themeTokens.accent }}>
                  {cardCategory.displayName}
                </span>
              )}
              <Link href={`/${card.category.toLowerCase()}/card/${card.id}`} className="text-sm font-medium leading-tight hover:underline">
                {card.name}
              </Link>
              <p className="truncate text-xs text-foreground/50">{card.series}</p>
              <p className="mt-auto text-sm font-semibold">
                ฿{card.askingPrice.toLocaleString()}
                <UsdHint amountThb={card.askingPrice} className="text-xs" />
              </p>
              {card.status !== "Sold" ? (
                <button
                  onClick={() => onMarkSold(card)}
                  className="booth-target mt-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent-dark"
                >
                  Mark Sold
                </button>
              ) : (
                <span className="mt-1 rounded-md bg-surface-1 px-2 py-1 text-center text-xs text-foreground/50">Sold</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
