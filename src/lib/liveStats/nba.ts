import type { LiveStatsResult } from "./types";

const BASE_URL = "https://api.balldontlie.io/v1";

async function balldontlieFetch(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: process.env.BALLDONTLIE_API_KEY ?? "" },
  });
  if (!res.ok) throw new Error(`balldontlie request failed (${res.status})`);
  return res.json();
}

export async function fetchNbaStats(params: { playerName: string; year: number | null }): Promise<LiveStatsResult> {
  if (!process.env.BALLDONTLIE_API_KEY) {
    return { ok: false, error: "BALLDONTLIE_API_KEY is not configured on the server." };
  }

  const playerSearch = await balldontlieFetch(`/players?search=${encodeURIComponent(params.playerName)}`);
  const player = playerSearch.data?.[0];
  if (!player) {
    return { ok: false, error: `No player found matching "${params.playerName}".` };
  }

  const season = params.year ?? new Date().getFullYear() - 1;
  const averages = await balldontlieFetch(`/season_averages?season=${season}&player_ids[]=${player.id}`);
  const stat = averages.data?.[0];
  if (!stat) {
    return { ok: false, error: `No ${season} season averages found for ${params.playerName}.` };
  }

  return {
    ok: true,
    stats: {
      provider: "balldontlie",
      playerName: `${player.first_name} ${player.last_name}`,
      team: player.team?.full_name ?? null,
      position: player.position || null,
      season: String(season),
      summary: [
        { label: "Games Played", value: String(stat.games_played ?? "—") },
        { label: "PPG", value: stat.pts !== undefined ? Number(stat.pts).toFixed(1) : "—" },
        { label: "RPG", value: stat.reb !== undefined ? Number(stat.reb).toFixed(1) : "—" },
        { label: "APG", value: stat.ast !== undefined ? Number(stat.ast).toFixed(1) : "—" },
      ],
      fetchedAt: new Date().toISOString(),
    },
  };
}
