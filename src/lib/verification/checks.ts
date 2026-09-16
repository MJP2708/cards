import { fingerprint } from "@/lib/import/fingerprint";
import type { LiveStatsSnapshot } from "@/lib/liveStats";
import { inferSportFromTeam, sportForCategory } from "./teams";

/**
 * The individual correctness checks.
 *
 * Every check returns one of four outcomes, and the distinction between the last
 * two is what keeps the overall status honest:
 *
 *  - `pass`    checked, looks right
 *  - `fail`    checked, looks wrong — carries a severity
 *  - `unknown` attempted, could not be settled ("couldn't confirm"). This must
 *              never read as `pass`, or a card nobody could actually verify ends
 *              up wearing a green tick.
 *  - `skipped` never attempted, because the check does not apply to this card or
 *              the data source is switched off install-wide. This is not a
 *              finding and does not hold a card back from VERIFIED — otherwise a
 *              store without an eBay key would see every card permanently
 *              flagged, which is noise rather than signal.
 */
export type CheckOutcome =
  | { result: "pass"; check: string }
  | { result: "fail"; check: string; severity: "high" | "low"; note: string }
  | { result: "unknown"; check: string; note: string }
  | { result: "skipped"; check: string; note: string };

export type VerifiableCard = {
  id: string;
  category: string;
  name: string;
  series: string;
  year: number | null;
  cardNumber: string | null;
  grade: string | null;
  attributes: unknown;
  costBasis: number;
  askingPrice: number;
  liveStats: unknown;
  /** From the enrichment pass: null | pending | processing | enriched | skipped | failed. */
  enrichmentStatus?: string | null;
};

function teamOf(card: VerifiableCard): string | null {
  const attrs = (card.attributes as Record<string, unknown> | null) ?? {};
  const team = attrs.team;
  return typeof team === "string" && team.trim() ? team.trim() : null;
}

// ── Internal consistency ────────────────────────────────────────────────────

/** Does the team belong to a different sport than the category claims? */
export function checkTeamSport(card: VerifiableCard): CheckOutcome {
  const check = "teamSport";
  const team = teamOf(card);
  if (!team) return { result: "skipped", check, note: "No team on this card." };

  const categorySport = sportForCategory(card.category);
  if (categorySport === "unknown") {
    return { result: "skipped", check, note: `No sport is defined for the "${card.category}" category.` };
  }

  const teamSport = inferSportFromTeam(team);
  if (teamSport === "unknown") {
    // Not a finding: an unrecognised club name is a gap in our list, not evidence.
    return { result: "skipped", check, note: `"${team}" isn't in the known-teams list, so its sport can't be checked.` };
  }

  if (teamSport !== categorySport) {
    return {
      result: "fail",
      check,
      severity: "high",
      note: `Team "${team}" looks like a ${teamSport === "nba" ? "basketball" : "football"} team, but this card is filed under ${card.category}.`,
    };
  }
  return { result: "pass", check };
}

/** Is the year plausible on its own, and against a year written into the set name? */
export function checkYearPlausible(card: VerifiableCard, now = new Date()): CheckOutcome {
  const check = "year";
  if (card.year === null) return { result: "skipped", check, note: "No year on this card." };

  const currentYear = now.getFullYear();
  // Sets are routinely released ahead of their branded year, so allow next year.
  if (card.year > currentYear + 1) {
    return { result: "fail", check, severity: "high", note: `Year ${card.year} is in the future.` };
  }
  if (card.year < 1860) {
    return { result: "fail", check, severity: "high", note: `Year ${card.year} predates trading cards.` };
  }

  // Series names usually carry their own year ("2023 Panini Prizm"). When they do,
  // it is a free cross-check against the year column.
  const inSeries = card.series.match(/\b(1[89]\d{2}|20\d{2})\b/);
  if (!inSeries) return { result: "pass", check };

  const seriesYear = Number(inSeries[1]);
  // A one-year gap is normal: "2023-24 Panini Prizm" is sold as a 2023 or 2024 card.
  if (Math.abs(seriesYear - card.year) <= 1) return { result: "pass", check };

  return {
    result: "fail",
    check,
    severity: "low",
    note: `Year is ${card.year} but the set name says ${seriesYear} ("${card.series}").`,
  };
}

/** Recognised third-party graders. A card is otherwise expected to say "Raw". */
const GRADERS = ["psa", "bgs", "bvg", "sgc", "cgc", "csg", "hga", "tag", "isa", "gma", "ksa", "ags", "pgs", "rcg"];
const RAW_SPELLINGS = ["raw", "ungraded", "none", "n a", "na", "nm", "no grade"];

/** Is the grade either "Raw" or a real grading-company format? */
export function checkGradeFormat(card: VerifiableCard): CheckOutcome {
  const check = "grade";
  const raw = card.grade?.trim();
  if (!raw) return { result: "skipped", check, note: "No grade on this card." };

  const value = raw.toLowerCase().replace(/[^a-z0-9. ]+/g, " ").replace(/\s+/g, " ").trim();
  if (RAW_SPELLINGS.includes(value)) return { result: "pass", check };

  // "PSA 10", "BGS 9.5", "SGC 8", and qualified forms like "PSA 10 GEM MT".
  const match = value.match(/^([a-z]+)\s*(\d{1,2}(?:\.\d)?)\b/);
  if (match && GRADERS.includes(match[1])) {
    const score = Number(match[2]);
    if (score >= 1 && score <= 10) return { result: "pass", check };
    return {
      result: "fail",
      check,
      severity: "low",
      note: `Grade "${raw}" has an out-of-range score — graders run 1 to 10.`,
    };
  }

  return {
    result: "fail",
    check,
    severity: "low",
    note: `Grade "${raw}" isn't "Raw" or a recognised grader format (e.g. "PSA 10", "BGS 9.5").`,
  };
}

/**
 * Is the asking price sane against cost?
 *
 * Selling below cost is a legitimate decision, so this distinguishes a plausible
 * markdown from something that reads like a slipped digit. Only the latter is
 * called out as high severity.
 */
export function checkPriceSanity(card: VerifiableCard): CheckOutcome {
  const check = "price";
  const { askingPrice, costBasis } = card;

  if (askingPrice === 0 && costBasis === 0) {
    return { result: "skipped", check, note: "No cost or asking price recorded." };
  }
  if (askingPrice === 0) {
    return {
      result: "fail",
      check,
      severity: "high",
      note: `Asking price is 0 but cost basis is ${costBasis} — price looks unset.`,
    };
  }
  if (costBasis === 0) {
    // Common and harmless for gifts, pulls and unpriced intake — worth a note, not a flag.
    return { result: "skipped", check, note: "No cost basis recorded, so margin can't be checked." };
  }

  if (askingPrice >= costBasis) return { result: "pass", check };

  const ratio = costBasis / askingPrice;

  // An order of magnitude below cost is a dropped-digit signature, not a
  // discount: nobody deliberately lists a 12,000 card at 250. Keyed on magnitude
  // rather than on an exact power of ten, because the slipped digit is relative
  // to the price the seller meant to type, which we cannot see — only cost.
  if (ratio >= 10) {
    return {
      result: "fail",
      check,
      severity: "high",
      note: `Asking ${askingPrice} is about ${Math.round(ratio)}x below cost ${costBasis} — looks like a mistyped price.`,
    };
  }

  if (askingPrice < costBasis * 0.5) {
    return {
      result: "fail",
      check,
      severity: "high",
      note: `Asking ${askingPrice} is less than half the cost basis ${costBasis} — possible price typo.`,
    };
  }

  return {
    result: "fail",
    check,
    severity: "low",
    note: `Asking ${askingPrice} is below cost ${costBasis} — intentional markdown, or a mistake?`,
  };
}

/**
 * Is an identical card already sitting in inventory?
 *
 * Reuses the import deduplication fingerprint, so "the same card" means exactly
 * what it means on the import staging screen rather than a second, subtly
 * different definition.
 */
export function checkDuplicate(
  card: VerifiableCard,
  fingerprintIndex: Map<string, { id: string; name: string }[]>
): CheckOutcome {
  const check = "duplicate";
  const others = (fingerprintIndex.get(fingerprint(card)) ?? []).filter((other) => other.id !== card.id);
  if (others.length === 0) return { result: "pass", check };

  return {
    result: "fail",
    check,
    severity: "low",
    note: `${others.length} other card${others.length === 1 ? "" : "s"} in inventory ${others.length === 1 ? "has" : "have"} identical details — should ${others.length === 1 ? "this be" : "these be"} one line with a higher quantity?`,
  };
}

// ── Factual check, against data enrichment already fetched ──────────────────

/**
 * Was this player actually on this team that season?
 *
 * Reads the snapshot that the enrichment pass already stored on the card rather
 * than calling API-Sports again. The provider answered this exact question during
 * import; asking twice would double quota spend against a free tier whose binding
 * limit is 10 requests per minute.
 *
 * When there is no snapshot, *why* there is none decides the outcome, and the
 * two reasons are genuinely different claims about the card:
 *
 *  - the provider looked and found nothing (`genuineMiss`, recorded in
 *    EnrichmentCache as `hit: false`) — evidence the name or set may be wrong,
 *    so the card is left unconfirmed and says so;
 *  - the free tier refused the season, the quota ran out, or the key was
 *    rejected — infrastructure, nothing to do with this card, so the check is
 *    skipped rather than held against it.
 *
 * Conflating them flagged every card in a store on the free plan, which buries
 * the handful that are actually wrong.
 */
export function checkTeamForSeason(
  card: VerifiableCard,
  statsConfigured: boolean,
  genuineMiss = false
): CheckOutcome {
  const check = "teamSeason";
  const team = teamOf(card);
  if (!team) return { result: "skipped", check, note: "No team on this card to check." };
  if (sportForCategory(card.category) === "unknown") {
    return { result: "skipped", check, note: "No stats provider covers this category." };
  }
  if (!statsConfigured) {
    return { result: "skipped", check, note: "Stats lookups are switched off (no API key configured)." };
  }

  const stats = card.liveStats as LiveStatsSnapshot | null;
  if (!stats) {
    if (genuineMiss) {
      return {
        result: "unknown",
        check,
        note: `Couldn't confirm the team — the stats provider has no record of ${card.name} in this set, which may mean the name or set is wrong.`,
      };
    }
    if (card.enrichmentStatus === "failed") {
      return {
        result: "skipped",
        check,
        note: "Team check skipped — the stats lookup didn't complete (plan or quota limit), which says nothing about this card.",
      };
    }
    if (card.enrichmentStatus === "skipped") {
      return { result: "skipped", check, note: "No stats provider covers this card." };
    }
    return {
      result: "unknown",
      check,
      note: "Couldn't confirm the team — no stats have been fetched for this card yet.",
    };
  }

  // The snapshot is only evidence about the season it was taken for.
  if (card.year !== null && stats.season !== String(card.year)) {
    return {
      result: "unknown",
      check,
      note: `Couldn't confirm the team — the stats on file are for the ${stats.season} season, not ${card.year}.`,
    };
  }
  if (!stats.team) {
    return { result: "unknown", check, note: "Couldn't confirm the team — the stats on file name no team." };
  }

  const claimed = team.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const actual = stats.team.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const claimedWords = claimed.split(" ").filter(Boolean);
  const actualWords = actual.split(" ").filter(Boolean);
  // "Lakers" vs "Los Angeles Lakers" is a match; any shared significant word counts,
  // since sellers write the short form and providers write the full one.
  const overlap = claimedWords.some((word) => word.length > 2 && actualWords.includes(word));

  if (overlap) return { result: "pass", check };

  return {
    result: "fail",
    check,
    severity: "low",
    note: `Card says ${team}, but ${stats.provider === "api-nba" ? "API-NBA" : "API-Football"} has ${stats.playerName} at ${stats.team} for the ${stats.season} season — team may be incorrect.`,
  };
}

// ── Price sanity against market comps ──────────────────────────────────────

export type CompSnapshot = { medianPrice: number; sampleSize: number; capturedAt: Date };

/**
 * Is the asking price wildly off what the card has recently sold/listed for?
 *
 * Reads comp snapshots already on record; it never fetches. Comps cost an eBay
 * call each and the importer already has a path for gathering them — this check
 * grades what is there, and honestly reports having skipped when there is nothing.
 */
export function checkPriceAgainstComps(
  card: VerifiableCard,
  comp: CompSnapshot | null,
  compSourceAvailable: boolean
): CheckOutcome {
  const check = "comps";
  if (!comp) {
    return {
      result: "skipped",
      check,
      note: compSourceAvailable
        ? "No price comps on record for this card yet — run Refresh comps to enable this check."
        : "Price check skipped — no comp source is available right now (eBay is pending account approval).",
    };
  }
  if (card.askingPrice === 0) {
    return { result: "skipped", check, note: "No asking price to compare against comps." };
  }

  const ratio = card.askingPrice / comp.medianPrice;
  // Small samples are weak evidence; widen the tolerance rather than crying wolf.
  const bound = comp.sampleSize >= 5 ? 3 : 5;

  if (ratio > bound) {
    return {
      result: "fail",
      check,
      severity: "low",
      note: `Asking ${card.askingPrice} is ${ratio.toFixed(1)}x the comp median of ${comp.medianPrice} (${comp.sampleSize} listings).`,
    };
  }
  if (ratio < 1 / bound) {
    return {
      result: "fail",
      check,
      severity: "low",
      note: `Asking ${card.askingPrice} is well under the comp median of ${comp.medianPrice} (${comp.sampleSize} listings).`,
    };
  }
  return { result: "pass", check };
}
