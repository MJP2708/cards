/**
 * eBay Browse API client for price comps.
 *
 * Two things to keep in mind about what this returns:
 *  - Browse searches ACTIVE listings, so these are asking prices, not sold prices.
 *    Sold comps live behind the limited-release Marketplace Insights API.
 *  - Matching is by search text, so a result is a best-effort guess. Comps are stored
 *    under a distinct source so they are never mistaken for a comp you logged yourself.
 */
const HOSTS = {
  production: { api: "https://api.ebay.com", auth: "https://api.ebay.com" },
  sandbox: { api: "https://api.sandbox.ebay.com", auth: "https://api.sandbox.ebay.com" },
} as const;

export const EBAY_COMP_SOURCE = "eBay (auto)";

function hosts() {
  return process.env.EBAY_ENV === "sandbox" ? HOSTS.sandbox : HOSTS.production;
}

export function hasEbayCredentials() {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

export function missingCredentialsError() {
  return "EBAY_CLIENT_ID and EBAY_CLIENT_SECRET are not configured on the server.";
}

// Application tokens last ~2 hours. Cache in module scope and refresh a minute early;
// a cold serverless instance simply fetches a new one.
let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Negative cache. While eBay is rejecting our credentials there is no point paying a
 * round trip on every click — remember the failure briefly and fail fast instead.
 * Cleared as soon as a token succeeds, so restored access is picked up immediately.
 */
let authFailure: { message: string; until: number } | null = null;
const AUTH_FAILURE_TTL_MS = 5 * 60 * 1000;

export function ebayAuthFailure(): string | null {
  if (authFailure && Date.now() < authFailure.until) return authFailure.message;
  return null;
}

/** Lets the diagnostics screen force a real check rather than reading the cache. */
export function clearEbayAuthFailure() {
  authFailure = null;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const known = ebayAuthFailure();
  if (known) throw new Error(known);

  const credentials = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${hosts().auth}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const message =
      res.status === 401
        ? "eBay rejected the credentials (401). Production keysets stay disabled until eBay's Marketplace Account Deletion requirement is met or an exemption is granted."
        : `eBay auth failed (${res.status}). ${detail.slice(0, 200)}`;
    authFailure = { message, until: Date.now() + AUTH_FAILURE_TTL_MS };
    throw new Error(message);
  }

  authFailure = null;
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(0, (body.expires_in - 60) * 1000),
  };
  return cachedToken.value;
}

export type EbayComp = {
  title: string;
  priceUsd: number;
  currency: string;
  url: string | null;
  condition: string | null;
};

/**
 * Builds the search text from the card's identifying fields. Series names usually
 * already carry the year ("2023 Panini Prizm"), so prepending it again produced
 * "2023 2023 Panini Prizm ..." — a duplicated token that narrows eBay's matching
 * for no benefit. Only add the year when the series doesn't already state it.
 */
export function buildQuery(card: {
  name: string;
  series: string;
  year: number | null;
  cardNumber: string | null;
}): string {
  const series = card.series?.trim() ?? "";
  const year = card.year && !series.includes(String(card.year)) ? card.year : null;
  return [year, series, card.name?.trim(), card.cardNumber?.trim()].filter(Boolean).join(" ").trim();
}

export async function searchEbayComps(query: string, limit = 10): Promise<EbayComp[]> {
  const token = await getAccessToken();
  const url = `${hosts().api}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=${limit}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`eBay search failed (${res.status}). ${detail.slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    itemSummaries?: {
      title?: string;
      price?: { value?: string; currency?: string };
      itemWebUrl?: string;
      condition?: string;
    }[];
  };

  return (body.itemSummaries ?? [])
    .map((item) => {
      const value = Number(item.price?.value);
      if (!Number.isFinite(value)) return null;
      return {
        title: item.title ?? query,
        priceUsd: value,
        currency: item.price?.currency ?? "USD",
        url: item.itemWebUrl ?? null,
        condition: item.condition ?? null,
      };
    })
    .filter((item): item is EbayComp => item !== null);
}
