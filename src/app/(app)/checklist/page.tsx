"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useCategories } from "@/hooks/useCategories";
import { useCards, useUpdateCard } from "@/lib/data/cards";

export default function ChecklistPage() {
  const t = useTranslations("checklist");
  const common = useTranslations("common");
  const { data: categories } = useCategories();
  const { data: cards, isLoading } = useCards({ status: "In Stock" });
  const updateCard = useUpdateCard();

  const grouped = useMemo(() => {
    const map = new Map<string, typeof cards>();
    for (const card of cards ?? []) {
      if (!map.has(card.category)) map.set(card.category, []);
      map.get(card.category)!.push(card);
    }
    return map;
  }, [cards]);

  if (isLoading) return <p className="text-sm text-foreground/60">{common("loading")}</p>;

  const totalPacked = cards?.filter((c) => c.packed).length ?? 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-foreground/60">{t("summary", { packed: totalPacked, total: cards?.length ?? 0 })}</p>
      </div>

      {Array.from(grouped.entries()).map(([categoryKey, catCards]) => {
        const category = categories?.find((c) => c.key.toLowerCase() === categoryKey.toLowerCase());
        const packedCount = catCards!.filter((c) => c.packed).length;
        return (
          <section key={categoryKey} className="rounded-lg border border-border-1 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className="h-2 w-2 rounded-full" style={{ background: category?.themeTokens.accent ?? "#64748B" }} />
              {t("categorySummary", { category: category?.displayName ?? categoryKey, packed: packedCount, total: catCards!.length })}
            </h2>
            <ul className="divide-y divide-border-1">
              {catCards!.map((card) => (
                <li key={card.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {card.name} <span className="text-foreground/50">({card.series})</span>
                  </span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={card.packed}
                      onChange={(e) => updateCard.mutate({ id: card.id, input: { packed: e.target.checked } })}
                    />
                    {t("packed")}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {(cards?.length ?? 0) === 0 && <p className="text-sm text-foreground/50">{t("noCards")}</p>}
    </div>
  );
}
