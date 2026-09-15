/**
 * Card identity for import deduplication.
 *
 * A fingerprint answers "which physical card is this?" and therefore uses only
 * identity-defining fields. Price, cost and quantity describe *this listing* of
 * the card and are deliberately excluded — a re-import at a new price must still
 * recognise the card, which is the entire point.
 *
 * Fingerprints are never compared across stores. Every call site derives its
 * candidate set from a store-scoped query (`src/lib/db/scoped.ts`), so one
 * seller's inventory can never match another's.
 */

export type FingerprintSource = {
  category: string;
  name: string;
  series: string;
  year?: number | null;
  cardNumber?: string | null;
  grade?: string | null;
};

/**
 * Normalising is what makes "PSA 10", "psa10" and "PSA  10" one card.
 * Punctuation goes because "#23" and "23" are the same card number; case and
 * runs of whitespace go for the same reason.
 */
function norm(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Unit separator — cannot occur in a normalised part, so parts can't bleed together. */
const SEPARATOR = String.fromCharCode(31);

/** Full identity: two cards with the same value are the same card. */
export function fingerprint(card: FingerprintSource): string {
  return [
    norm(card.category),
    norm(card.name),
    norm(card.series),
    norm(card.year ?? ""),
    norm(card.cardNumber),
    norm(card.grade),
  ].join(SEPARATOR);
}

/**
 * Identity minus grade. Used only to find *candidates* for the "possible match"
 * state: same card, different grade is either a typo in one of the two rows or a
 * genuinely separate slab, and nothing about the data can tell us which. So it
 * is surfaced for a human rather than decided here.
 */
export function looseFingerprint(card: FingerprintSource): string {
  return [
    norm(card.category),
    norm(card.name),
    norm(card.series),
    norm(card.year ?? ""),
    norm(card.cardNumber),
  ].join(SEPARATOR);
}

/** Human-readable reason a loose match is not an exact one. */
export function describeDifference(a: FingerprintSource, b: FingerprintSource): string | null {
  if (norm(a.grade) !== norm(b.grade)) {
    const left = a.grade?.trim() || "ungraded";
    const right = b.grade?.trim() || "ungraded";
    return `grade differs (sheet says ${left}, inventory says ${right})`;
  }
  return null;
}
