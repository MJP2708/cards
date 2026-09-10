import type { LiveStatsResult } from "./types";
import { fetchNbaStats } from "./nba";
import { fetchFootballStats } from "./football";

export type { LiveStatsSnapshot, LiveStatsResult } from "./types";

export async function fetchLiveStats(card: {
  category: string;
  name: string;
  year: number | null;
  attributes: unknown;
}): Promise<LiveStatsResult> {
  const attrs = (card.attributes as Record<string, unknown> | null) ?? {};
  const team = typeof attrs.team === "string" ? attrs.team : null;

  // Provider limits are ordinary outcomes, not crashes: a free plan refusing a season,
  // an exhausted daily quota or a network blip all arrive here as thrown errors. Fold
  // them into the result type so callers render "may be stale" instead of a broken
  // screen — LiveStatsResult already models failure, so nothing above needs to catch.
  try {
    if (card.category === "NBA") {
      return await fetchNbaStats({ playerName: card.name, year: card.year });
    }
    if (card.category === "Football") {
      return await fetchFootballStats({ playerName: card.name, team, year: card.year });
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Live stats lookup failed." };
  }
  return { ok: false, error: `Live stats aren't available for the "${card.category}" category.` };
}
