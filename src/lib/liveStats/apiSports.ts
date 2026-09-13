// A single API-Sports account key works across every sport they publish — only the
// hostname changes per product (v3.football, v2.nba, ...). Each API still has its own
// subscription and its own daily quota; the credential is what's shared.
// https://api-sports.io
export const API_SPORTS = {
  nba: { host: "v2.nba.api-sports.io", label: "API-NBA" },
  football: { host: "v3.football.api-sports.io", label: "API-Football" },
} as const;

export type ApiSport = keyof typeof API_SPORTS;

export const API_SPORTS_ENV_VAR = "API_SPORTS_KEY";

/**
 * Read via a literal `process.env.X` rather than a dynamic lookup: Next.js only
 * special-cases the literal form, and it keeps the variable greppable.
 */
export function apiSportsKey() {
  return process.env.API_SPORTS_KEY;
}

export function hasApiSportsKey() {
  return Boolean(apiSportsKey());
}

export function missingKeyError() {
  return `${API_SPORTS_ENV_VAR} is not configured on the server.`;
}

/**
 * A rejected key comes back as a normal HTTP 403, but quota, plan and bad-parameter
 * problems arrive as HTTP 200 with a populated `errors` field and an empty `response`
 * — those would otherwise read as "no player found". Unpack both shapes so the
 * Fact Sheet shows the real reason.
 */
/**
 * The free tier's binding limit is 10 requests PER MINUTE (the 100/day cap is the one
 * that gets advertised). Every call goes through one shared pacer so a burst of
 * enrichment can't trip it — measured from the last request, across all sports,
 * since the quota is per account rather than per API.
 */
const MIN_REQUEST_INTERVAL_MS = 6_500;
let lastRequestAt = 0;
let pacerChain: Promise<void> = Promise.resolve();

function pace(): Promise<void> {
  // Chained rather than parallel so concurrent callers queue instead of all
  // reading the same `lastRequestAt` and firing together.
  pacerChain = pacerChain.then(async () => {
    const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
  });
  return pacerChain;
}

export async function apiSportsFetch(sport: ApiSport, path: string) {
  const { host, label } = API_SPORTS[sport];
  await pace();
  const res = await fetch(`https://${host}${path}`, {
    headers: { "x-apisports-key": apiSportsKey() ?? "" },
  });
  if (!res.ok) throw new Error(`${label} request failed (${res.status})`);

  const body = await res.json();
  // `errors` is [] when clean, an object keyed by reason (token, requests, plan) when not.
  const errors = body?.errors;
  if (errors && !Array.isArray(errors) && Object.keys(errors).length > 0) {
    throw classifyApiSportsError(label, errors as Record<string, string>);
  }
  return body;
}

/** Why a call failed. `plan` and `auth` can never succeed on a retry; the others can. */
export type ApiSportsErrorKind = "plan" | "quota" | "auth" | "other";

export class ApiSportsError extends Error {
  constructor(
    message: string,
    readonly kind: ApiSportsErrorKind,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "ApiSportsError";
  }
}

/**
 * Turns API-Sports' raw `errors` object into something a user can act on.
 *
 * The upstream text ("Free plans do not have access to this season.") reads like a
 * bug report rather than a plan limit, and every failure used to be marked
 * retryable — so a season the free tier will never serve was re-requested on every
 * pass, spending quota that could have gone to cards that *are* covered.
 */
export function classifyApiSportsError(label: string, errors: Record<string, string>): ApiSportsError {
  const text = Object.values(errors).join(" ").trim();
  const keys = Object.keys(errors).map((key) => key.toLowerCase());
  const lower = text.toLowerCase();

  if (keys.includes("plan") || lower.includes("free plan") || lower.includes("do not have access")) {
    return new ApiSportsError(
      `${label}: paid plan only — the free tier doesn't cover this data. Everything else still imports.`,
      "plan",
      false
    );
  }
  if (keys.includes("requests") || lower.includes("rate limit") || lower.includes("too many")) {
    return new ApiSportsError(
      `${label}: request limit reached — this card will be retried automatically.`,
      "quota",
      true
    );
  }
  if (keys.includes("token") || lower.includes("token")) {
    return new ApiSportsError(`${label}: API key was rejected. Check ${API_SPORTS_ENV_VAR}.`, "auth", false);
  }
  return new ApiSportsError(`${label}: ${text || "request failed"}`, "other", true);
}
