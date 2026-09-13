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
   * Two independent questions, previously conflated into one flag:
   *
   * `retryable` — is it worth asking again later? False for a plan limit or a
   *   rejected key, which will fail identically forever.
   * `genuineMiss` — did the provider actually answer "no such player"? Only these
   *   may be cached as a miss. A missing team on the card, a plan limit or an
   *   outage must never be, or the card stays "no match" for the cache's whole TTL
   *   even after the underlying problem is fixed.
   */
  | { ok: false; error: string; retryable?: boolean; genuineMiss?: boolean };
