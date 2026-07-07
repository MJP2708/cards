import type { CardDetailDTO } from "@/lib/data/types";

const SPORTS_CATEGORIES = new Set(["NBA", "Football"]);

// Rule-based explainer built from data already on the card + manually entered comps —
// no live stats/market feed is wired up yet, so this reasons over what the seller has on hand.
export function explainPrice(card: CardDetailDTO): string[] {
  const reasons: string[] = [];
  const isSports = SPORTS_CATEGORIES.has(card.category);

  if (isSports) {
    reasons.push(
      card.cardType?.toLowerCase().includes("rookie")
        ? "Rookie cards carry a premium — they're the first licensed card of a player's career and demand tends to track early performance/hype."
        : "Base and veteran cards are priced more on team/player popularity than scarcity alone."
    );
  } else {
    reasons.push(
      "Pricing for TCG cards tracks tournament relevance and nostalgia demand more than raw print numbers."
    );
  }

  if (card.rarity) {
    const printRunMatch = card.rarity.match(/\/(\d+)/);
    if (printRunMatch) {
      const printRun = Number(printRunMatch[1]);
      reasons.push(
        printRun <= 25
          ? `An extremely limited print run (${card.rarity}) is the single biggest driver of this price.`
          : `Print run of ${card.rarity} adds scarcity value, though it's not ultra-limited.`
      );
    } else {
      reasons.push(`Rarity tier "${card.rarity}" affects how many copies are realistically available to buyers.`);
    }
  }

  if (card.grade && card.grade !== "Raw") {
    reasons.push(`Professional grading (${card.grade}) removes condition risk for the buyer, which commands a premium over raw copies.`);
  }

  if (card.isHot) {
    reasons.push(card.hotNote ? `Currently flagged hot: ${card.hotNote}` : "Currently flagged as a hot card — reprice before quoting.");
  }

  if (card.priceComps.length > 0) {
    const prices = card.priceComps.map((c) => c.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    reasons.push(
      min === max
        ? `Comps are consistent around ฿${min.toLocaleString()}.`
        : `Comps range from ฿${min.toLocaleString()} to ฿${max.toLocaleString()}, suggesting some room to negotiate within that band.`
    );
  } else {
    reasons.push("No comps logged yet — add some from eBay/130point/PWCC (sports) or TCGplayer/PriceCharting (TCG) to back up this price.");
  }

  return reasons;
}
