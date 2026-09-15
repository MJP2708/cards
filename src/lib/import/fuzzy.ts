/**
 * String similarity for column-header matching.
 *
 * Header matching cannot be exact-equality: a seller's sheet says "Player Name",
 * "PLAYER", "Card Name" or "Name of Card" for the same field. It also cannot be
 * substring containment — "Card Number" contains "Card Name"'s stem and would
 * match it, while "Qty." would match nothing.
 *
 * So this scores on two axes and takes the better of them:
 *  - character bigrams (Dice), which tolerates typos and inflections
 *    ("Quantitiy" ~ "Quantity", "Rarities" ~ "Rarity")
 *  - whole-token overlap, which tolerates extra or reordered words
 *    ("Name of Player" ~ "Player Name")
 *
 * Both are needed: bigrams alone rate "Set" against "Series/Set" poorly because
 * length differs so much, and token overlap alone is blind to misspellings.
 */

/** Lowercase, drop a trailing unit/currency note, and split into word tokens. */
export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    // "Cost Basis (THB)" is still cost basis — the note is not part of the name.
    .replace(/\([^)]*\)/g, " ")
    // "#" carries the whole meaning of a header like "Stock #" or "Card #", and
    // stripping it as punctuation collapses "Stock #" (a SKU) into "Stock" (a
    // quantity) — two different columns that then fight over the same field. It
    // is the word "number", so it is kept as one.
    .replace(/#/g, " no ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Bare alphanumeric form, used as the cache/alias key. "Card Number" -> "cardnumber". */
export function normalizeHeader(value: string): string {
  return tokenize(value).join("");
}

function bigrams(value: string): string[] {
  if (value.length < 2) return value ? [value] : [];
  const out: string[] = [];
  for (let i = 0; i < value.length - 1; i++) out.push(value.slice(i, i + 2));
  return out;
}

/** Sørensen–Dice over character bigrams: 0 = nothing shared, 1 = identical. */
function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  const left = bigrams(a);
  const right = bigrams(b);
  if (left.length === 0 || right.length === 0) return 0;

  // Multiset intersection — a repeated bigram may only be consumed once.
  const pool = new Map<string, number>();
  for (const gram of left) pool.set(gram, (pool.get(gram) ?? 0) + 1);

  let hits = 0;
  for (const gram of right) {
    const remaining = pool.get(gram) ?? 0;
    if (remaining > 0) {
      pool.set(gram, remaining - 1);
      hits++;
    }
  }
  return (2 * hits) / (left.length + right.length);
}

/**
 * Token overlap, weighted toward the shorter side.
 *
 * Plain Jaccard punishes "Player" against "Player Name" (0.5) even though one is
 * plainly the other abbreviated. Dividing by the smaller token set instead asks
 * "is the shorter name fully contained in the longer?", which is the question
 * that actually matters for headers, then damps the result by the size mismatch
 * so "Name" doesn't score a perfect 1.0 against "Name Of Buyer Contact Note".
 */
function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let shared = 0;
  for (const token of new Set(a)) if (setB.has(token)) shared++;
  if (shared === 0) return 0;

  const containment = shared / Math.min(new Set(a).size, setB.size);
  const balance = Math.min(a.length, b.length) / Math.max(a.length, b.length);
  return containment * (0.6 + 0.4 * balance);
}

/** 0..1 similarity between two human-written column names. */
export function similarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  const flatA = tokensA.join("");
  const flatB = tokensB.join("");
  if (!flatA || !flatB) return 0;
  if (flatA === flatB) return 1;
  return Math.max(diceCoefficient(flatA, flatB), tokenOverlap(tokensA, tokensB));
}

/** Best score of `value` against any of `candidates`, plus which one won. */
export function bestMatch(
  value: string,
  candidates: string[]
): { candidate: string | null; score: number } {
  let best: { candidate: string | null; score: number } = { candidate: null, score: 0 };
  for (const candidate of candidates) {
    const score = similarity(value, candidate);
    if (score > best.score) best = { candidate, score };
  }
  return best;
}
