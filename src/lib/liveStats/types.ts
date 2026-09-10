export type LiveStatsSnapshot = {
  provider: "api-nba" | "api-football";
  playerName: string;
  team: string | null;
  position: string | null;
  season: string;
  summary: { label: string; value: string }[];
  fetchedAt: string;
};

export type LiveStatsResult =
  | { ok: true; stats: LiveStatsSnapshot }
  /**
   * `retryable` separates "this player genuinely isn't in the provider's data" from
   * "the provider was rate-limited / down / misconfigured just now". Only the former
   * may be cached as a miss — caching a transient failure poisons the result for days.
   */
  | { ok: false; error: string; retryable?: boolean };
