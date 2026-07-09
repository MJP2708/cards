import type { CardDetailDTO } from "@/lib/data/types";

const SPORTS_CATEGORIES = new Set(["NBA", "Football"]);

type Translator = (key: string, params?: Record<string, string | number>) => string;

// Rule-based explainer built from data already on the card + manually entered comps —
// no live stats/market feed is wired up yet, so this reasons over what the seller has on hand.
// `t` is the "cardDetail" next-intl translator, passed in since this isn't a component/hook.
export function explainPrice(card: CardDetailDTO, t: Translator): string[] {
  const reasons: string[] = [];
  const isSports = SPORTS_CATEGORIES.has(card.category);

  if (isSports) {
    reasons.push(card.cardType?.toLowerCase().includes("rookie") ? t("reasonRookie") : t("reasonBaseVeteran"));
  } else {
    reasons.push(t("reasonTcgGeneral"));
  }

  if (card.rarity) {
    const printRunMatch = card.rarity.match(/\/(\d+)/);
    if (printRunMatch) {
      const printRun = Number(printRunMatch[1]);
      reasons.push(
        printRun <= 25
          ? t("reasonLimitedPrintRun", { rarity: card.rarity })
          : t("reasonPrintRun", { rarity: card.rarity })
      );
    } else {
      reasons.push(t("reasonRarityTier", { rarity: card.rarity }));
    }
  }

  if (card.grade && card.grade !== "Raw") {
    reasons.push(t("reasonGrading", { grade: card.grade }));
  }

  if (card.isHot) {
    reasons.push(card.hotNote ? t("reasonHotWithNote", { note: card.hotNote }) : t("reasonHotNoNote"));
  }

  if (card.priceComps.length > 0) {
    const prices = card.priceComps.map((c) => c.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    reasons.push(
      min === max
        ? t("reasonCompsConsistent", { price: min.toLocaleString() })
        : t("reasonCompsRange", { min: min.toLocaleString(), max: max.toLocaleString() })
    );
  } else {
    reasons.push(t("reasonNoComps"));
  }

  return reasons;
}
