import type { LiveStatsResult } from "./types";
import { ApiSportsError } from "./apiSports";
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
    // A plan limit or a rejected key will fail identically forever, so it must not
    // be marked retryable — otherwise every enrichment pass spends quota re-asking
    // a question the free tier has already refused.
    if (error instanceof ApiSportsError) {
      return { ok: false, error: error.message, retryable: error.retryable };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Live stats lookup failed.", retryable: true };
  }
  return { ok: false, error: `Live stats aren't available for the "${card.category}" category.` };
}
