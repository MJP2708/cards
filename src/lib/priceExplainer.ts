import type { CardDetailDTO } from "@/lib/data/types";

const SPORTS_CATEGORIES = new Set(["NBA", "Football"]);

type Translator = (key: string, params?: Record<string, string | number>) => string;

export type PriceReasonIcon = "rookie" | "veteran" | "tcg" | "rarity" | "grading" | "hot" | "comps" | "noComps";

export type PriceReason = { icon: PriceReasonIcon; text: string };

// Rule-based explainer built from data already on the card + manually entered comps —
// no live stats/market feed is wired up yet, so this reasons over what the seller has on hand.
// `t` is the "cardDetail" next-intl translator, passed in since this isn't a component/hook.
// Each reason carries an icon key (not a component) so this stays a plain data module —
// the Fact Sheet panel maps the key to a lucide icon for the evidence-chip display.
export function explainPrice(card: CardDetailDTO, t: Translator): PriceReason[] {
  const reasons: PriceReason[] = [];
  const isSports = SPORTS_CATEGORIES.has(card.category);

  if (isSports) {
    const isRookie = card.cardType?.toLowerCase().includes("rookie");
    reasons.push({ icon: isRookie ? "rookie" : "veteran", text: isRookie ? t("reasonRookie") : t("reasonBaseVeteran") });
  } else {
    reasons.push({ icon: "tcg", text: t("reasonTcgGeneral") });
  }

  if (card.rarity) {
    const printRunMatch = card.rarity.match(/\/(\d+)/);
    if (printRunMatch) {
      const printRun = Number(printRunMatch[1]);
      reasons.push({
        icon: "rarity",
        text: printRun <= 25 ? t("reasonLimitedPrintRun", { rarity: card.rarity }) : t("reasonPrintRun", { rarity: card.rarity }),
      });
    } else {
      reasons.push({ icon: "rarity", text: t("reasonRarityTier", { rarity: card.rarity }) });
    }
  }

  if (card.grade && card.grade !== "Raw") {
    reasons.push({ icon: "grading", text: t("reasonGrading", { grade: card.grade }) });
  }

  if (card.isHot) {
    reasons.push({
      icon: "hot",
      text: card.hotNote ? t("reasonHotWithNote", { note: card.hotNote }) : t("reasonHotNoNote"),
    });
  }

  if (card.priceComps.length > 0) {
    const prices = card.priceComps.map((c) => c.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    reasons.push({
      icon: "comps",
      text: min === max ? t("reasonCompsConsistent", { price: min.toLocaleString() }) : t("reasonCompsRange", { min: min.toLocaleString(), max: max.toLocaleString() }),
    });
  } else {
    reasons.push({ icon: "noComps", text: t("reasonNoComps") });
  }

  return reasons;
}
