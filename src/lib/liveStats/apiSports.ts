// Both sports are API-Sports products, but each one is a separate subscription with
// its own key and its own daily quota — registering through a product dashboard
// (api-football.com, api-nba.com) gives you one key per API, not one key for all.
// https://api-sports.io
export const API_SPORTS = {
  nba: {
    host: "v2.nba.api-sports.io",
    label: "API-NBA",
    envVar: "API_NBA_KEY",
    // Read via a literal `process.env.X` rather than a dynamic `process.env[envVar]`
    // lookup: Next.js only special-cases the literal form, and it stays greppable.
    key: () => process.env.API_NBA_KEY,
  },
  football: {
    host: "v3.football.api-sports.io",
    label: "API-Football",
    envVar: "API_FOOTBALL_KEY",
    key: () => process.env.API_FOOTBALL_KEY,
  },
} as const;

export type ApiSport = keyof typeof API_SPORTS;

export function hasApiSportsKey(sport: ApiSport) {
  return Boolean(API_SPORTS[sport].key());
}

export function missingKeyError(sport: ApiSport) {
  return `${API_SPORTS[sport].envVar} is not configured on the server.`;
}

/**
 * A rejected key comes back as a normal HTTP 403, but quota, plan and bad-parameter
 * problems arrive as HTTP 200 with a populated `errors` field and an empty `response`
 * — those would otherwise read as "no player found". Unpack both shapes so the
 * Fact Sheet shows the real reason.
 */
export async function apiSportsFetch(sport: ApiSport, path: string) {
  const { host, label, key } = API_SPORTS[sport];
  const res = await fetch(`https://${host}${path}`, {
    headers: { "x-apisports-key": key() ?? "" },
  });
  if (!res.ok) throw new Error(`${label} request failed (${res.status})`);

  const body = await res.json();
  // `errors` is [] when clean, an object keyed by reason (token, requests, plan) when not.
  const errors = body?.errors;
  if (errors && !Array.isArray(errors) && Object.keys(errors).length > 0) {
    throw new Error(`${label}: ${Object.values(errors).join(" ")}`);
  }
  return body;
}
