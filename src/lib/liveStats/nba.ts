import type { LiveStatsResult } from "./types";
import { apiSportsFetch, hasApiSportsKey, missingKeyError } from "./apiSports";

type NbaPlayer = {
  id: number;
  firstname?: string;
  lastname?: string;
  leagues?: { standard?: { pos?: string } };
};

type NbaStatLine = {
  min?: string | null;
  points?: number | null;
  totReb?: number | null;
  assists?: number | null;
  pos?: string | null;
  team?: { name?: string } | null;
};

type AverageableStat = "points" | "totReb" | "assists";

function nbaFetch(path: string) {
  return apiSportsFetch("nba", path);
}

/** API-NBA reports minutes as "34:16" (and "", null, or "0:00" for a player who sat). */
function playedMinutes(min: string | null | undefined): number {
  if (!min) return 0;
  const [minutes, seconds] = min.split(":");
  return (Number(minutes) || 0) + (Number(seconds) || 0) / 60;
}

function average(lines: NbaStatLine[], field: AverageableStat): string {
  if (lines.length === 0) return "—";
  const total = lines.reduce((sum, line) => sum + (Number(line[field]) || 0), 0);
  return (total / lines.length).toFixed(1);
}

export async function fetchNbaStats(params: { playerName: string; year: number | null }): Promise<LiveStatsResult> {
  if (!hasApiSportsKey()) {
    return { ok: false, error: missingKeyError(), retryable: true };
  }

  // API-NBA's search matches a single name field and wants 3+ characters, so a full
  // "First Last" card name often misses — fall back to the surname on its own.
  const candidates = [params.playerName, params.playerName.trim().split(/\s+/).pop() ?? ""].filter(
    (term, index, all) => term.length >= 3 && all.indexOf(term) === index
  );

  const wanted = params.playerName.trim().toLowerCase();
  let player: NbaPlayer | undefined;
  for (const term of candidates) {
    const search = await nbaFetch(`/players?search=${encodeURIComponent(term)}`);
    const results = (search.response as NbaPlayer[] | undefined) ?? [];
    if (results.length === 0) continue;
    // Taking results[0] blindly matched "Seth Curry" for a Stephen Curry card —
    // confidently wrong data is worse than none, so prefer an exact full-name hit.
    player =
      results.find((r) => `${r.firstname ?? ""} ${r.lastname ?? ""}`.trim().toLowerCase() === wanted) ??
      results[0];
    if (player) break;
  }
  if (!player) {
    return { ok: false, error: `No player found matching "${params.playerName}".` };
  }

  const season = params.year ?? new Date().getFullYear() - 1;
  const statistics = await nbaFetch(`/players/statistics?id=${player.id}&season=${season}`);

  // Unlike a season-averages endpoint, this returns one row per game — including
  // games the player was inactive for — so filter to real appearances and average.
  const lines = (statistics.response as NbaStatLine[] | undefined) ?? [];
  const played = lines.filter((line) => playedMinutes(line.min) > 0);
  if (played.length === 0) {
    return {
      ok: false,
      error: `No ${season} season stats found for ${params.playerName} (API-NBA's free tier only covers recent seasons).`,
    };
  }

  const latest = played[played.length - 1];

  return {
    ok: true,
    stats: {
      provider: "api-nba",
      playerName: `${player.firstname ?? ""} ${player.lastname ?? ""}`.trim() || params.playerName,
      team: latest.team?.name ?? null,
      position: player.leagues?.standard?.pos || latest.pos || null,
      season: String(season),
      summary: [
        { label: "Games Played", value: String(played.length) },
        { label: "PPG", value: average(played, "points") },
        { label: "RPG", value: average(played, "totReb") },
        { label: "APG", value: average(played, "assists") },
      ],
      fetchedAt: new Date().toISOString(),
    },
  };
}
