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

  if (card.category === "NBA") {
    return fetchNbaStats({ playerName: card.name, year: card.year });
  }
  if (card.category === "Football") {
    return fetchFootballStats({ playerName: card.name, team, year: card.year });
  }
  return { ok: false, error: `Live stats aren't available for the "${card.category}" category.` };
}
