import type { StoreDb } from "@/lib/db/scoped";
import { API_SPORTS, apiSportsKey, API_SPORTS_ENV_VAR } from "@/lib/liveStats/apiSports";
import { clearEbayAuthFailure, hasEbayCredentials, searchEbayComps } from "@/lib/comps/ebay";

export type IntegrationStatus = {
  key: string;
  label: string;
  envVars: string[];
  /** "ok" | "down" | "unconfigured" — unconfigured means no key, which is not a failure. */
  state: "ok" | "down" | "unconfigured";
  detail: string;
  powers: string;
  ms: number | null;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: string; ms: number }> {
  const started = Date.now();
  try {
    return { value: await fn(), ms: Date.now() - started };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), ms: Date.now() - started };
  }
}

async function checkDatabase(db: StoreDb): Promise<IntegrationStatus> {
  const base = {
    key: "database",
    label: "Neon Postgres (pooled)",
    envVars: ["DATABASE_URL"],
    powers: "Everything — inventory, sales, reports",
  };
  // Scoped: the owner is shown their own card count, not the install total.
  const result = await timed(() => db.card.count());
  if (result.error) {
    return { ...base, state: "down", detail: result.error, ms: result.ms };
  }
  return { ...base, state: "ok", detail: `Connected — ${result.value} cards`, ms: result.ms };
}

async function checkApiSports(sport: keyof typeof API_SPORTS, label: string, powers: string): Promise<IntegrationStatus> {
  const base = { key: `apisports-${sport}`, label, envVars: [API_SPORTS_ENV_VAR], powers };

  if (!apiSportsKey()) {
    return { ...base, state: "unconfigured", detail: `${API_SPORTS_ENV_VAR} is not set.`, ms: null };
  }

  // Cheapest possible call that still proves auth works.
  const path = sport === "nba" ? "/seasons" : "/timezone";
  const result = await timed(async () => {
    const res = await fetch(`https://${API_SPORTS[sport].host}${path}`, {
      headers: { "x-apisports-key": apiSportsKey() ?? "" },
    });
    const body = await res.json();
    const errors = body?.errors;
    if (errors && !Array.isArray(errors) && Object.keys(errors).length > 0) {
      throw new Error(Object.values(errors).join(" "));
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return body;
  });

  if (result.error) return { ...base, state: "down", detail: result.error, ms: result.ms };
  return { ...base, state: "ok", detail: "Authenticated and responding", ms: result.ms };
}

async function checkEbay(force: boolean): Promise<IntegrationStatus> {
  const base = {
    key: "ebay",
    label: "eBay Browse API",
    envVars: ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"],
    powers: "Price comps on the Fact Sheet",
  };

  if (!hasEbayCredentials()) {
    return { ...base, state: "unconfigured", detail: "EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are not set.", ms: null };
  }

  // Only bypass the fast-fail cache when the operator explicitly asks to re-check —
  // otherwise this screen would defeat the point of not retrying a known-down service.
  if (force) clearEbayAuthFailure();

  const result = await timed(() => searchEbayComps("2023 Panini Prizm", 1));
  if (result.error) return { ...base, state: "down", detail: result.error, ms: result.ms };
  return { ...base, state: "ok", detail: "Authenticated and returning listings", ms: result.ms };
}

function checkBlob(): IntegrationStatus {
  const base = {
    key: "blob",
    label: "Vercel Blob",
    envVars: ["BLOB_READ_WRITE_TOKEN"],
    powers: "Card photo upload",
  };
  // Verified by presence only: any real check would upload a file.
  return process.env.BLOB_READ_WRITE_TOKEN
    ? { ...base, state: "ok", detail: "Token present (not test-uploaded)", ms: null }
    : { ...base, state: "unconfigured", detail: "BLOB_READ_WRITE_TOKEN is not set.", ms: null };
}

export async function runDiagnostics(db: StoreDb, options: { force?: boolean } = {}): Promise<IntegrationStatus[]> {
  const [database, nba, football, ebay] = await Promise.all([
    checkDatabase(db),
    checkApiSports("nba", "API-NBA (API-Sports)", "NBA live stats + import enrichment"),
    checkApiSports("football", "API-Football (API-Sports)", "Football live stats + import enrichment"),
    checkEbay(options.force ?? false),
  ]);
  return [database, nba, football, ebay, checkBlob()];
}
