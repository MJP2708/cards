import type { LiveStatsResult } from "./types";

const BASE_URL = "https://v3.football.api-sports.io";

async function apiFootballFetch(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY ?? "" },
  });
  if (!res.ok) throw new Error(`API-Football request failed (${res.status})`);
  return res.json();
}

export async function fetchFootballStats(params: {
  playerName: string;
  team: string | null;
  year: number | null;
}): Promise<LiveStatsResult> {
  if (!process.env.API_FOOTBALL_KEY) {
    return { ok: false, error: "API_FOOTBALL_KEY is not configured on the server." };
  }
  if (!params.team) {
    return { ok: false, error: "Add a team on this card first — team is required to look up a player." };
  }

  const teamSearch = await apiFootballFetch(`/teams?search=${encodeURIComponent(params.team)}`);
  const teamId = teamSearch.response?.[0]?.team?.id;
  if (!teamId) {
    return { ok: false, error: `No team found matching "${params.team}".` };
  }

  const season = params.year ?? 2023;
  const playerSearch = await apiFootballFetch(
    `/players?search=${encodeURIComponent(params.playerName)}&team=${teamId}&season=${season}`
  );
  const entry = playerSearch.response?.[0];
  if (!entry) {
    return {
      ok: false,
      error: `No ${season} season stats found for "${params.playerName}" at ${params.team} (API-Football's free tier only covers some seasons/leagues).`,
    };
  }

  const stat = entry.statistics?.[0];
  return {
    ok: true,
    stats: {
      provider: "api-football",
      playerName: entry.player?.name ?? params.playerName,
      team: stat?.team?.name ?? params.team,
      position: stat?.games?.position ?? null,
      season: String(season),
      summary: [
        { label: "Appearances", value: String(stat?.games?.appearences ?? "—") },
        { label: "Goals", value: String(stat?.goals?.total ?? "—") },
        { label: "Assists", value: String(stat?.goals?.assists ?? "—") },
        { label: "Rating", value: stat?.games?.rating ? Number(stat.games.rating).toFixed(1) : "—" },
      ],
      fetchedAt: new Date().toISOString(),
    },
  };
}
