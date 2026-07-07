export type LiveStatsSnapshot = {
  provider: "balldontlie" | "api-football";
  playerName: string;
  team: string | null;
  position: string | null;
  season: string;
  summary: { label: string; value: string }[];
  fetchedAt: string;
};

export type LiveStatsResult = { ok: true; stats: LiveStatsSnapshot } | { ok: false; error: string };
